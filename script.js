// PLATFORM DETECTION
function detectPlatform(url) {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.com') || urlLower.includes('/share/v/')) {
        return 'facebook';
    } else if (urlLower.includes('tiktok.com') || urlLower.includes('vt.tiktok.com')) {
        return 'tiktok';
    }
    
    return null;
}

// DOM ELEMENTS & EVENT LISTENERS
const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const platformHint = document.getElementById('platformHint');
const resultDiv = document.getElementById('result');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const videoPreview = document.getElementById('videoPreview');
const downloadOptions = document.getElementById('downloadOptions');

downloadBtn.addEventListener('click', handleDownload);

videoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleDownload();
    }
});

// MAIN DOWNLOAD HANDLER
async function handleDownload() {
    const url = videoUrlInput.value.trim();
    
    if (!url) {
        showError('Silakan masukkan link video!');
        return;
    }
    
    if (!isValidUrl(url)) {
        showError('Link tidak valid. Pastikan URL lengkap dengan https://');
        return;
    }
    
    const platform = detectPlatform(url);
    
    if (!platform) {
        showError('Platform tidak didukung! Gunakan link Facebook atau TikTok saja.');
        return;
    }
    
    hideResults();
    setLoading(true, platform);
    
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout. Silakan coba lagi.')), 30000)
        );
        
        const videoData = await Promise.race([
            fetchVideoData(url, platform),
            timeoutPromise
        ]);
        
        displayResults(videoData);
    } catch (error) {
        console.error('Download error:', error);
        showError(error.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
        setLoading(false);
    }
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function fetchWithTimeout(url, options, timeout = 15000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
    ]);
}

// API HANDLERS
async function fetchVideoData(url, platform) {
    try {
        const cobaltUrl = 'https://api.cobalt.tools/api/json';
        
        const response = await fetchWithTimeout(cobaltUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                vCodec: 'h264',
                vQuality: '720',
                aFormat: 'mp3',
                filenamePattern: 'basic',
                isAudioOnly: false,
                isTTFullAudio: false,
                isAudioMuted: false,
                dubLang: false,
                disableMetadata: false
            })
        }, 15000);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.status === 'error' || data.status === 'rate-limit') {
                throw new Error(data.text || 'API rate limit or error');
            }
            
            if (data.status === 'redirect' || data.status === 'stream') {
                return formatCobaltResponse(data, url, platform);
            } else if (data.status === 'picker') {
                return formatCobaltPickerResponse(data, url, platform);
            }
        }
        
        throw new Error('Cobalt API failed, trying platform-specific API...');
        
    } catch (error) {
        let videoData;
        
        switch(platform) {
            case 'facebook':
                videoData = await fetchFacebookVideo(url);
                break;
            case 'tiktok':
                videoData = await fetchTikTokVideo(url);
                break;
            default:
                throw new Error('Platform tidak didukung');
        }
        
        return videoData;
    }
}

function formatCobaltResponse(data, url, platform) {
    const downloadLinks = [];
    
    if (data.url) {
        downloadLinks.push({
            quality: 'High Quality',
            size: 'Video/Image',
            url: data.url,
            type: 'media'
        });
    }
    
    let author = 'user';
    const usernameMatch = url.match(/@([a-zA-Z0-9._]+)/);
    if (usernameMatch) {
        author = usernameMatch[1];
    }
    
    return {
        success: true,
        platform: platform,
        title: data.filename || `${platform} media`,
        author: author,
        thumbnail: data.thumbnail || null,
        downloadLinks: downloadLinks
    };
}

function formatCobaltPickerResponse(data, url, platform) {
    const downloadLinks = [];
    
    if (data.picker && Array.isArray(data.picker)) {
        data.picker.forEach((item, index) => {
            downloadLinks.push({
                quality: `Media ${index + 1}`,
                size: item.type || 'Media',
                url: item.url,
                type: item.type || 'media'
            });
        });
    }
    
    let author = 'user';
    const usernameMatch = url.match(/@([a-zA-Z0-9._]+)/);
    if (usernameMatch) {
        author = usernameMatch[1];
    }
    
    return {
        success: true,
        platform: platform,
        title: `${platform} media (${downloadLinks.length} files)`,
        author: author,
        thumbnail: data.picker[0]?.thumb || null,
        downloadLinks: downloadLinks
    };
}

// API HANDLERS - Facebook
async function fetchFacebookVideo(url) {
    try {
        const response = await fetchWithTimeout('/api/facebook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: url })
        }, 15000);
        
        if (!response.ok) {
            throw new Error('Backend API error');
        }
        
        const data = await response.json();
        
        if (!data.success || !data.downloadUrl) {
            throw new Error(data.message || 'Gagal mengambil video');
        }
        
        // Extract username from URL
        let author = 'Facebook User';
        const authorMatch = url.match(/facebook\.com\/([^\/\?]+)/);
        if (authorMatch && authorMatch[1] && !['share', 'watch', 'reel', 'video', 'videos'].includes(authorMatch[1])) {
            author = authorMatch[1];
        }
        
        // Detect video type
        let title = '📱 Facebook Video';
        if (url.includes('/reel/')) {
            title = '🎬 Facebook Reel';
        } else if (url.includes('/share/')) {
            title = '🔗 Facebook Shared Video';
        }
        
        return {
            success: true,
            platform: 'facebook',
            title: title,
            author: author,
            thumbnail: null,
            note: '✨ Video diambil dalam kualitas terbaik yang tersedia',
            downloadLinks: [{
                quality: '🎥 HD Quality',
                size: 'Best Available',
                url: data.downloadUrl
            }]
        };
        
    } catch (error) {
        throw new Error('Gagal mengambil video Facebook. Pastikan link valid dan video bersifat publik. Format yang didukung: video post, reel, share link, fb.watch');
    }
}

// API HANDLERS - TikTok
async function fetchTikTokVideo(url) {
    try {
        const apiUrl = `https://tikwm.com/api/`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                url: url,
                hd: 1
            })
        });
        
        if (!response.ok) {
            throw new Error('Gagal mengambil video TikTok');
        }
        
        const data = await response.json();
        
        if (data.code !== 0 || !data.data) {
            throw new Error('Video tidak ditemukan atau private');
        }
        
        const videoData = data.data;
        const downloadLinks = [];
        
        if (videoData.hdplay) {
            downloadLinks.push({
                quality: 'HD - No Watermark',
                size: 'High Quality',
                url: videoData.hdplay
            });
        }
        
        if (videoData.play) {
            downloadLinks.push({
                quality: 'SD - No Watermark',
                size: 'Standard Quality',
                url: videoData.play
            });
        }
        
        if (videoData.wmplay) {
            downloadLinks.push({
                quality: 'With Watermark',
                size: 'Original',
                url: videoData.wmplay
            });
        }
        
        if (videoData.music) {
            downloadLinks.push({
                quality: 'Audio Only (MP3)',
                size: 'Music',
                url: videoData.music
            });
        }
        
        return {
            success: true,
            platform: 'tiktok',
            title: videoData.title || 'TikTok Video',
            thumbnail: videoData.cover || videoData.origin_cover,
            duration: formatDuration(videoData.duration),
            author: videoData.author?.unique_id || '@user',
            downloadLinks: downloadLinks
        };
    } catch (error) {
        throw new Error('Gagal mengambil video TikTok. Pastikan link valid dan video bersifat publik.');
    }
}

// UI DISPLAY FUNCTIONS
function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function displayResults(data) {
    if (!data.success) {
        showError('Gagal mengambil video');
        return;
    }
    
    window.currentVideoData = data;
    
    // Generate thumbnail HTML based on platform
    let thumbnailHtml;
    if (data.thumbnail) {
        thumbnailHtml = `<img src="${data.thumbnail}" alt="Video thumbnail" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">`;
    } else if (data.platform === 'facebook') {
        thumbnailHtml = `<div style="background: linear-gradient(135deg, #9370DB 0%, #8B7AB8 100%); padding: 60px 40px; border-radius: 12px; color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">📹</div>
            <div style="font-size: 16px; font-weight: 500; opacity: 0.9;">Preview tidak tersedia</div>
            <div style="font-size: 13px; margin-top: 8px; opacity: 0.7;">Video siap didownload</div>
        </div>`;
    } else {
        thumbnailHtml = `<div style="background: linear-gradient(135deg, #9370DB 0%, #8B7AB8 100%); padding: 80px; border-radius: 12px; color: white; font-size: 48px; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            📹
        </div>`;
    }
    
    videoPreview.innerHTML = `
        <div style="text-align: center;">
            ${thumbnailHtml}
            <p style="margin-top: 16px; font-weight: 600; color: #333; font-size: 16px;">${data.title || 'Video'}</p>
            ${data.author ? `<p style="color: #8B7AB8; font-size: 14px; margin-top: 4px;">👤 ${data.author}</p>` : ''}
            ${data.duration ? `<p style="color: #666; font-size: 14px; margin-top: 4px;">⏱️ ${data.duration}</p>` : ''}
            ${data.note ? `<div style="margin-top: 16px; padding: 12px 16px; background: linear-gradient(135deg, rgba(147, 112, 219, 0.1), rgba(139, 122, 184, 0.1)); border-left: 3px solid #9370DB; border-radius: 8px; font-size: 13px; color: #6B5B95; text-align: left; line-height: 1.6;">${data.note}</div>` : ''}
        </div>
    `;
    
    downloadOptions.innerHTML = data.downloadLinks.map((link, index) => `
        <button class="quality-btn" onclick="downloadVideo(${index}, '${link.quality}')" style="background: white; border: 2px solid #D3CCE3; padding: 16px 20px; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 12px; font-family: 'Cormorant Garamond', serif;">
            <span style="text-align: left;">
                <strong style="color: #6B5B95; font-size: 15px; display: block; margin-bottom: 4px;">${link.quality}</strong>
                <span style="color: #8B7AB8; font-size: 13px; display: block;">${link.size}</span>
            </span>
            <span style="background: linear-gradient(135deg, #9370DB, #8B7AB8); color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                ${link.manual ? '🔗 Buka' : '⬇ Download'}
            </span>
        </button>
    `).join('');
    
    resultDiv.style.display = 'block';
    
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// DOWNLOAD HANDLER
async function downloadVideo(linkIndex, quality) {
    try {
        const videoData = window.currentVideoData;
        if (!videoData || !videoData.downloadLinks[linkIndex]) {
            showNotification('Data video tidak ditemukan', 'error');
            return;
        }
        
        const link = videoData.downloadLinks[linkIndex];
        const url = link.url;
        
        // Handle manual/redirect links
        if (link.manual || link.type === 'redirect') {
            window.open(url, '_blank');
            showNotification('Link dibuka di tab baru.\n\nCara download:\n1. Klik kanan pada media\n2. Pilih "Save as"', 'info');
            return;
        }
        
        showNotification('Memulai download...', 'info');
        
        // Generate filename
        const author = videoData.author || 'user';
        const title = videoData.title || 'video';
        const platform = videoData.platform || 'social';
        
        const cleanAuthor = author.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const timestamp = Date.now();
        
        let extension = 'mp4';
        if (link.type === 'image' || quality.toLowerCase().includes('image') || quality.toLowerCase().includes('photo')) {
            extension = 'jpg';
        } else if (quality.toLowerCase().includes('audio') || quality.toLowerCase().includes('mp3')) {
            extension = 'mp3';
        }
        
        const filename = `${platform}_${cleanAuthor}_${cleanTitle}_${timestamp}.${extension}`;
        
        // Try blob download (best method)
        try {
            const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': '*/*'
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(downloadUrl);
                }, 100);
                
                showNotification(`✅ Download berhasil!\n${filename}`, 'success');
                return;
            }
        } catch (error) {
            // Fallback to direct download
        }
        
        // Try direct anchor download
        try {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
            }, 100);
            
            showNotification('Download dimulai!\nCek folder Downloads Anda.', 'success');
            return;
        } catch (error) {
            // Fallback to open in new tab
        }
        
        // Last resort: open in new tab
        window.open(url, '_blank');
        showNotification('Video dibuka di tab baru.\n\nKlik kanan → "Save video as" untuk download manual.', 'info');
        
    } catch (error) {
        showNotification('Download gagal. Coba lagi atau gunakan platform lain.', 'error');
    }
}

// UTILITY FUNCTIONS
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        font-size: 14px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function showError(message) {
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function hideResults() {
    resultDiv.style.display = 'none';
    errorDiv.style.display = 'none';
}

function setLoading(isLoading, platform = null) {
    if (isLoading) {
        let loadingText = 'Casting spell...';
        
        if (platform === 'facebook') {
            loadingText = 'Casting spell for Facebook...';
        } else if (platform === 'tiktok') {
            loadingText = 'Casting spell for TikTok...';
        }
        
        btnText.textContent = loadingText;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'inline-block';
        downloadBtn.disabled = true;
        videoUrlInput.disabled = true;
    } else {
        btnText.textContent = '✦ Cast Download Spell ✦';
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        downloadBtn.disabled = false;
        videoUrlInput.disabled = false;
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

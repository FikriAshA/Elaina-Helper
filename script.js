function detectPlatform(url) {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.com') || urlLower.includes('/share/v/')) {
        return 'facebook';
    } else if (urlLower.includes('tiktok.com') || urlLower.includes('vt.tiktok.com')) {
        return 'tiktok';
    } else if (urlLower.includes('instagram.com')) {
        return 'instagram';
    }
    
    return null;
}

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
        showError('Platform tidak didukung! Gunakan link Facebook, TikTok, atau Instagram.');
        return;
    }
    
    hideResults();
    setLoading(true);
    
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

// Timeout helper
function fetchWithTimeout(url, options, timeout = 15000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
    ]);
}

// Main function: Fetch video data from multiple sources
async function fetchVideoData(url, platform) {
    try {
        console.log('Trying Cobalt API for', platform);
        
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
            console.log('Cobalt API response:', data);
            
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
        console.log('Cobalt API failed:', error.message);
        
        let videoData;
        
        switch(platform) {
            case 'facebook':
                videoData = await fetchFacebookVideo(url);
                break;
            case 'tiktok':
                videoData = await fetchTikTokVideo(url);
                break;
            case 'instagram':
                videoData = await fetchInstagramVideo(url);
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

async function fetchFacebookVideo(url) {
    console.log('Trying Facebook backend API...');
    
    try {
        // Call backend API (Vercel Serverless Function)
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
        
        // Return format yang konsisten
        return {
            success: true,
            platform: 'facebook',
            title: 'Facebook Video',
            thumbnail: 'https://via.placeholder.com/640x360?text=Facebook+Video',
            downloadLinks: [{
                quality: 'HD Quality',
                size: 'Best Available',
                url: data.downloadUrl
            }]
        };
        
    } catch (error) {
        console.error('Facebook API error:', error.message);
        throw new Error('Gagal mengambil video Facebook. Pastikan link valid dan video bersifat publik. Format yang didukung: video post, reel, share link, fb.watch');
    }
}

async function fetchInstagramVideo(url) {
    console.log('Trying Instagram backend API...');
    
    try {
        // Call backend API (Vercel Serverless Function)
        const response = await fetchWithTimeout('/api/instagram', {
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
            throw new Error(data.message || 'Gagal mengambil media');
        }
        
        // Return format yang konsisten
        return {
            success: true,
            platform: 'instagram',
            title: 'Instagram Post/Reel',
            thumbnail: 'https://via.placeholder.com/640x360?text=Instagram+Media',
            downloadLinks: [{
                quality: 'HD Quality',
                size: 'Best Available',
                url: data.downloadUrl
            }]
        };
        
    } catch (error) {
        console.error('Instagram API error:', error.message);
        throw new Error('Gagal mengambil media Instagram. Pastikan link valid dan post bersifat publik. Format yang didukung: /p/, /reel/, /tv/');
    }
}

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
        
        // HD video
        if (videoData.hdplay) {
            downloadLinks.push({
                quality: 'HD - No Watermark',
                size: 'High Quality',
                url: videoData.hdplay
            });
        }
        
        // Standard video
        if (videoData.play) {
            downloadLinks.push({
                quality: 'SD - No Watermark',
                size: 'Standard Quality',
                url: videoData.play
            });
        }
        
        // With watermark
        if (videoData.wmplay) {
            downloadLinks.push({
                quality: 'With Watermark',
                size: 'Original',
                url: videoData.wmplay
            });
        }
        
        // Music/Audio
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

function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Display results
function displayResults(data) {
    if (!data.success) {
        showError('Gagal mengambil video');
        return;
    }
    
    // Store data globally for download function
    window.currentVideoData = data;
    
    // Create video preview
    const thumbnailHtml = data.thumbnail ? 
        `<img src="${data.thumbnail}" alt="Video thumbnail" onerror="this.src='https://via.placeholder.com/640x360?text=Video+Preview'">` :
        `<div style="background: #f0f0f0; padding: 60px; border-radius: 8px;">📹 Video Preview</div>`;
    
    videoPreview.innerHTML = `
        <div style="text-align: center;">
            ${thumbnailHtml}
            <p style="margin-top: 10px; font-weight: 600; color: #333;">${data.title || 'Video'}</p>
            ${data.duration ? `<p style="color: #666; font-size: 14px;">Durasi: ${data.duration}</p>` : ''}
            ${data.author ? `<p style="color: #666; font-size: 14px;">Oleh: ${data.author}</p>` : ''}
            ${data.note ? `<p style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 6px; font-size: 13px; color: #856404; text-align: left; white-space: pre-line;">${data.note}</p>` : ''}
        </div>
    `;
    
    // Create download options
    downloadOptions.innerHTML = data.downloadLinks.map((link, index) => `
        <button class="quality-btn" onclick="downloadVideo(${index}, '${link.quality}')">
            <span>
                <strong>${link.quality}</strong>
                <span style="color: #666; font-size: 13px; display: block;">${link.size}</span>
            </span>
            <span class="quality-badge">${link.manual ? '🔗 Buka' : '⬇ Download'}</span>
        </button>
    `).join('');
    
    resultDiv.style.display = 'block';
    
    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Download video with proper filename
async function downloadVideo(linkIndex, quality) {
    try {
        const videoData = window.currentVideoData;
        if (!videoData || !videoData.downloadLinks[linkIndex]) {
            showNotification('Data video tidak ditemukan', 'error');
            return;
        }
        
        const link = videoData.downloadLinks[linkIndex];
        const url = link.url;
        
        // For manual/redirect links, just open
        if (link.manual || link.type === 'redirect') {
            window.open(url, '_blank');
            showNotification('Link dibuka di tab baru.\n\nCara download:\n1. Klik kanan pada media\n2. Pilih "Save as"', 'info');
            return;
        }
        
        // Show download notification
        showNotification('Memulai download...', 'info');
        
        // Generate filename from username and title
        const author = videoData.author || 'user';
        const title = videoData.title || 'video';
        const platform = videoData.platform || 'social';
        
        // Clean filename - remove special characters
        const cleanAuthor = author.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const timestamp = Date.now();
        
        // Determine file extension
        let extension = 'mp4';
        if (link.type === 'image' || quality.toLowerCase().includes('image') || quality.toLowerCase().includes('photo')) {
            extension = 'jpg';
        } else if (quality.toLowerCase().includes('audio') || quality.toLowerCase().includes('mp3')) {
            extension = 'mp3';
        }
        
        // Create filename: platform_username_title_timestamp.ext
        const filename = `${platform}_${cleanAuthor}_${cleanTitle}_${timestamp}.${extension}`;
        
        try {
            console.log('Trying blob download...');
            
            const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': '*/*'
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                
                // Create download link
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
            console.log('Blob download failed:', error);
        }
        
        try {
            console.log('Trying direct anchor download...');
            
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
            console.log('Anchor download failed:', error);
        }
        
        console.log('Opening in new tab...');
        window.open(url, '_blank');
        showNotification('Video dibuka di tab baru.\n\nKlik kanan → "Save video as" untuk download manual.', 'info');
        
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Download gagal. Coba lagi atau gunakan platform lain.', 'error');
    }
}

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

function setLoading(isLoading) {
    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
        downloadBtn.disabled = true;
        videoUrlInput.disabled = true;
    } else {
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

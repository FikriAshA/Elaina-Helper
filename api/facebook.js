export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const { url } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      success: false,
      message: "URL Facebook tidak valid.",
    });
  }

  try {
    const apiUrl = "https://fdown.isuru.eu.org/download";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        quality: "best",
      }),
    });

    if (!response.ok) {
      throw new Error("Gagal menghubungi provider Facebook.");
    }

    const json = await response.json();

    if (json.status !== "success" || !json.download_url) {
      throw new Error(
        json.message || "Provider tidak mengembalikan link video yang valid."
      );
    }

    const downloadUrl = json.download_url;

    return res.status(200).json({
      success: true,
      downloadUrl,
    });
  } catch (err) {
    console.error("FB provider error:", err);
    return res.status(500).json({
      success: false,
      message:
        err.message ||
        "Server error FBdownder, atau provider lagi bermasalah. Coba lagi nanti.",
    });
  }
}

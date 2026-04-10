import AWS from "aws-sdk";
import multer from "multer";

const storage = multer.memoryStorage(); // ✅ IMPORTANT
const upload = multer({ storage });

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export const uploadDocument = [
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = req.file;

      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `documents/${Date.now()}-${file.originalname}`,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const data = await s3.upload(params).promise();

      return res.json({
        success: true,
        url: data.Location, // ✅ THIS IS S3 URL
      });

    } catch (error) {
      console.error("S3 Upload Error:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  },
];
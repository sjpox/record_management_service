import express from 'express'
import { S3Client } from '@aws-sdk/client-s3'
import multer from 'multer'
import multers3 from 'multer-s3'
import dotenv from 'dotenv'

dotenv.config()
const router = express.Router()

const s3 = new S3Client({
    region: process.env.AWS_REGION || "",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY || "",
        secretAccessKey: process.env.AWS_SECRET_KEY || ""
    }
})

const upload = multer({
    storage: multers3({
        s3: s3,
        bucket: process.env.AWS_BUCKET_NAME || "",
        metadata: (req, file, cb) => {
            cb(null, { fieldName: file.fieldname })
        },
        key: (req, file, cb) => {
            cb(null, Date.now().toString() + '-' + file.originalname)
        }
    })
})

router.get('/', (req, res) => {
    res.send("document")
})

router.post('/upload-multiple', upload.array("images", 5), (req, res)=> {
    const files = req.files;
    
    if(!files || files.length ===0)
        return res.status(400).json({ error: "No files uploaded"})
})

export default router
import express from 'express'
import { S3Client } from '@aws-sdk/client-s3'
import multer from 'multer'
import multers3 from 'multer-s3'
import dotenv from 'dotenv'
import SFTPClient from 'ssh2-sftp-client'
import { Client } from 'basic-ftp'
import path from 'path/posix'
import { Readable } from 'stream'

dotenv.config()
const router = express.Router()

// const s3 = new S3Client({
//     region: process.env.AWS_REGION || "",
//     credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY || "",
//         secretAccessKey: process.env.AWS_SECRET_KEY || ""
//     }
// })

// const upload = multer({
//     storage: multers3({
//         s3: s3,
//         bucket: process.env.AWS_BUCKET_NAME || "",
//         metadata: (req, file, cb) => {
//             cb(null, { fieldName: file.fieldname })
//         },
//         key: (req, file, cb) => {
//             cb(null, Date.now().toString() + '-' + file.originalname)
//         }
//     })
// })

// router.post('/upload-multiple', upload.array("images", 5), (req, res)=> {
//     const files = req.files;
    
//     if(!files || files.length ===0)
//         return res.status(400).json({ error: "No files uploaded"})
// })

const sftpConfig = {
    host: process.env.SFTP_HOST!,
    port: Number(process.env.SFTP_PORT),
    username: process.env.SFTP_USER!,
    password: process.env.SFTP_PASSWORD!
}
const sftp = new SFTPClient()
const uploadToSftp = async (file: Express.Multer.File) => {
    console.log(`Upload to SFTP ${file.originalname}`)
    const remotePath = path.join(
        process.env.SFTP_UPLOAD_DIR!,
        file.originalname
    )
    console.log(`remotePath: ${remotePath}`)
    console.log(`sftpConfig: ${JSON.stringify(sftpConfig)}`)
    try {
        await sftp.connect(sftpConfig)

        // upload file buffer
        await sftp.put(file.buffer, remotePath)
    } finally {
        await sftp.end()
    }
}

const multerFileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
})

const ftpConfig = {
    host: process.env.FTP_HOST!,
    port: Number(process.env.FTP_PORT),
    user: process.env.FTP_USER!,
    password: process.env.FTP_PASSWORD!,
    secure: true,
    secureOptions: {
        rejectUnauthorized: false, // self-signed cert
    },
}

const uploadToFTP = async (file: Express.Multer.File, filePath: string) => {
    const client = new Client()
    client.ftp.verbose = true

    try {
        await client.access(ftpConfig)
        await client.ensureDir(path.join(process.env.FTP_UPLOAD_DIR!, filePath))
        await client.uploadFrom(
            Readable.from([file.buffer]),
            path.join(process.env.FTP_UPLOAD_DIR!, filePath, file.originalname)
        )

        await client.send('QUIT')
    } catch (err) {
        console.log(err)
    } finally {
        client.close()
    }
}


router.post(
    '/upload-file',
    multerFileUpload.single('file'),
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' })
        }
        // read file path from multipart form fields (req.body) and validate
        const filePath = (req.body && (req.body.file_path ?? req.body.filePath)) as string | undefined
        if (!filePath) {
            return res.status(400).json({ message: 'No file_path provided' })
        }
        console.log('upload-file')
        try {
            await uploadToFTP(req.file, filePath)
            res.status(200).json({
                message: 'File uploaded successfully via FTP',
                filename: req.file.originalname
            })
        } catch (error) {
            console.log('FTP upload error:', error)
            res.status(500).json({ message: 'Upload failed'})
        }
    }
)

router.get('/', (req, res) => {
    res.send("document")
})



export default router
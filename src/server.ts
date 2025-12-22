import express, { type Request, type Response } from 'express'
import documentRouter from './router/document/document.ts'

export const app = express()
const PORT = 3000

app.get('/', (req: Request, res: Response)=> {
    return res
        .status(200)
        .json({
            'message': 'Successful'
        })
})

app.use('/document', documentRouter)

app.listen(PORT, ()=> {
    console.log(`Listening to port ${PORT}`)
})
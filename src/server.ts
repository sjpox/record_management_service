import express, { type Request, type Response } from 'express'
const app = express()
const PORT = 3000

app.get('/', (req: Request, res: Response)=> {
    return res
        .status(200)
        .json({
            'message': 'Successful'
        })
})

app.listen(PORT, ()=> {
    console.log(`Listening to port ${PORT}`)
})
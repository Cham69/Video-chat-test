//const { static } = require('express')
const express = require('express')
const path = require('path')
const app = express()

app.use(express.static('public'))
app.get('/', (req, res)=>{
    res.sendFile('index.html', {root: __dirname})
})

app.get('/chat', (req, res)=>{
    res.sendFile('chat.html', {root: __dirname})
})

app.listen(8000,()=>{
    console.log('Server listen at port 8000');
})
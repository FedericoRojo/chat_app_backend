const pool = require("../config/pool");
const {genPassword, validPassword} = require("../lib/passwordUtils");
const {issueJWT} = require('../lib/utils');
const cloudinary = require('cloudinary');
const streamifier = require('streamifier');
require('dotenv').config();


async function getUserChat(req,res){
    const {userId} = req.body;
    try{
        const {rows} = await pool.query('SELECT * FROM message WHERE (sender_id = $1 OR sender_id = $2) AND (receiver_id = $3 OR receiver_id = $4);', [userId, req.user.id, userId, req.user.id]);
        res.json({
            success: true,
            result: rows
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function getGroupChat(req,res){
    const {groupId} = req.body;
    try{
        const {rows} = await pool.query('SELECT * FROM groupmessage WHERE group_id = $1;', [groupId]);
        res.json({
            success: true,
            result: rows
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function createUserMessage(req,res){
    const {userId, text} = req.body;
    const file = req.file;

    if(file != null){

        const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.v2.uploader.upload_stream(
            { resource_type: "auto"},
            (error, result) => {
                if(error){
                    reject(new Error('Error while uploading to Cloudinary'));
                }else{
                    resolve(result);
                }
            }
        );
        streamifier.createReadStream(file.buffer).pipe(stream);
        });
        const imageResult = await pool.query('INSERT INTO image(img, public_id, resource_type) VALUES ($1,$2,$3) RETURNING id;', 
            [uploadResult.secure_url, uploadResult.public_id, uploadResult.resource_type]);
        await pool.query('INSERT INTO message(sender_id, receiver_id, text, image) VALUES ($1, $2, $3,$4);', [req.user.id, userId, text, imageResult.rows[0]]);
    }else{
        await pool.query('INSERT INTO message(sender_id, receiver_id, text) VALUES ($1, $2, $3);', [req.user.id, userId, text]);
    }

    res.json({
        success: true,
    });

}

async function createGroupMessage(req,res){
    const {groupId, text} = req.body;
    const file = req.file;

    if(file != null){
        const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.v2.uploader.upload_stream(
            { resource_type: "auto"},
            (error, result) => {
                if(error){
                    reject(new Error('Error while uploading to Cloudinary'));
                }else{
                    resolve(result);
                }
            }
        );
        streamifier.createReadStream(file.buffer).pipe(stream);
        });
        const imageResult = await pool.query('INSERT INTO image(img, public_id, resource_type) VALUES ($1,$2,$3) RETURNING id;', 
            [uploadResult.secure_url, uploadResult.public_id, uploadResult.resource_type]);
        await pool.query('INSERT INTO message(sender_id, group_id, text, image) VALUES ($1, $2, $3,$4);', [req.user.id, groupId, text, imageResult.rows[0]]);
    }else{
        await pool.query('INSERT INTO message(sender_id, receiver_id, text) VALUES ($1, $2, $3);', [req.user.id, groupId, text]);
    }

    res.json({
        success: true,
    });
}

async function updateUserMessage(req,res){
    const {messageID, text} = req.body;
    const file = req.file;

    try{
        if(file != null){
            const {rows} = await pool.query('SELECT * FROM message m JOIN image i ON m.image_id=i.id WHERE m.id = $1;', [messageID]);
            try{
                await cloudinary.v2.uploader.destroy(rows[0].public_id, {resource_type: rows[0].resource_type});
                await pool.query('DELETE FROM image WHERE public_id = $1,', rows[0].public_id);
            }catch(cloudinaryError){
                console.warn("Image not found in Cloudinary or deletion failer: ", cloudinaryError.message);
            }

            const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.v2.uploader.upload_stream(
                { resource_type: "auto"},
                (error, result) => {
                    if(error){
                        reject(new Error('Error while uploading to Cloudinary'));
                    }else{
                        resolve(result);
                    }
                }
            );
            streamifier.createReadStream(file.buffer).pipe(stream);
            });
            const imageResult = await pool.query('INSERT INTO image(img, public_id, resource_type) VALUES ($1,$2,$3) RETURNING id;', 
                [uploadResult.secure_url, uploadResult.public_id, uploadResult.resource_type]);
            await pool.query('UPDATE message SET text = $1, image = $2 WHERE id = $3;', [text, imageResult.rows[0], messageID]);
        }else{
            await pool.query('UPDATE message SET text = $1 WHERE id = $2;', [text, messageID]);
        }
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
    res.json({
        success: true,
    });
}

async function updateGroupMessage(req,res){
    const {messageID, text} = req.body;
    const file = req.file;
    try{
        if(file != null){
            const {rows} = await pool.query('SELECT * FROM groupmessage m JOIN image i ON m.image_id=i.id WHERE m.id = $1;', [messageID]);
            try{
                await cloudinary.v2.uploader.destroy(rows[0].public_id, {resource_type: rows[0].resource_type});
                await pool.query('DELETE FROM image WHERE public_id = $1,', rows[0].public_id);
            }catch(cloudinaryError){
                console.warn("Image not found in Cloudinary or deletion failer: ", cloudinaryError.message);
            }

            const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.v2.uploader.upload_stream(
                { resource_type: "auto"},
                (error, result) => {
                    if(error){
                        reject(new Error('Error while uploading to Cloudinary'));
                    }else{
                        resolve(result);
                    }
                }
            );
            streamifier.createReadStream(file.buffer).pipe(stream);
            });
            const imageResult = await pool.query('INSERT INTO image(img, public_id, resource_type) VALUES ($1,$2,$3) RETURNING id;', 
                [uploadResult.secure_url, uploadResult.public_id, uploadResult.resource_type]);
                await pool.query('UPDATE groupmessage SET text = $1, image = $2 WHERE id = $3;', [text, imageResult.rows[0], messageID]);
            }else{
                await pool.query('UPDATE groupmessage SET text = $1 WHERE id = $2;', [text, messageID]);
            }

        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function deleteMessage(req,res){
    const {messageID} = req.body;
    try{
        const {rows} = await pool.query('SELECT * FROM message m JOIN image i ON m.image_id=i.id WHERE m.id = $1 AND m.sender_id=$2;', [messageID, req.user.id]);
        try{
            await cloudinary.v2.uploader.destroy(rows[0].public_id, {resource_type: rows[0].resource_type});
            await pool.query('DELETE FROM image WHERE public_id = $1,', rows[0].public_id);
        }catch(cloudinaryError){
            console.warn("Image not found in Cloudinary or deletion failer: ", cloudinaryError.message);
        }

        await pool.query('DELETE FROM message WHERE id=$1 AND sender_id=$2', [messageID, req.user.id]);
        
        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function deleteGroupMessage(req,res){
    const {messageID} = req.body;
    try{
        const {rows} = await pool.query('SELECT * FROM groupmessage m JOIN image i ON m.image_id=i.id WHERE m.id = $1 AND m.sender_id=$2;', [messageID, req.user.id]);
        try{
            await cloudinary.v2.uploader.destroy(rows[0].public_id, {resource_type: rows[0].resource_type});
            await pool.query('DELETE FROM image WHERE public_id = $1,', rows[0].public_id);
        }catch(cloudinaryError){
            console.warn("Image not found in Cloudinary or deletion failer: ", cloudinaryError.message);
        }

        await pool.query('DELETE FROM groupmessage WHERE id=$1 AND sender_id=$2', [messageID, req.user.id]);
        
        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}



module.exports = {
    getUserChat,
    getGroupChat,
    createUserMessage,
    createGroupMessage,
    updateUserMessage,
    updateGroupMessage,
    deleteMessage,
    deleteGroupMessage
}


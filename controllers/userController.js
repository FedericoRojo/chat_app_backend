const pool = require("../config/pool");
const {genPassword, validPassword} = require("../lib/passwordUtils");
const {issueJWT} = require('../lib/utils');
const cloudinary = require('cloudinary');
const streamifier = require('streamifier');
require('dotenv').config();

async function registerUser(req, res) {
    const saltHash = genPassword(req.body.password);
    
    const salt = saltHash.salt;
    const hash = saltHash.hash;
    
    try {
        await pool.query('INSERT INTO users(username, hash, salt) VALUES ($1, $2, $3);', 
            [req.body.username, hash, salt]);
        
        res.json({ success: true});

    } catch (err) {
        res.json({ success: false, msg: err });
    }
} 

async function loginUser(req, res, next){
    try{
        const {rows} = await pool.query('SELECT * FROM users WHERE username = $1;', [req.body.username]);
        const user = rows[0];
        if(!user){
            return res.status(401).json({success: false, msg: 'could not find user'});
        }

        const isValid = validPassword(req.body.password, user.hash, user.salt);
        
        if(isValid){
            const tokenObject = issueJWT(user);
            res.status(200).json({
                result: {
                    username: user.username,
                    description: user.description,
                    image_id: user.image_id,
                    token: tokenObject.token,
                    expiresIn: tokenObject.expires },
                success: true
            });
        } else {
            res
            .status(401)
            .json({ success: false, msg: "you entered the wrong password" });
        }

    }catch(error){
        next(error);
    }
}

async function updateUser(req,res){
    //Puede estar mal el imageResult.rows, ver. Faltar multer en el otro archivo routes
    const {username, description, } = req.body;
    const file = req.file;
    try{
        if(file != null){
            const {rows} = await pool.query('SELECT * FROM image WHERE id = $1;', req.user.image_id);
            try{
                await cloudinary.v2.uploader.destroy(rows[0].public_id, {resource_type: rows[0].resource_type});
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
            await pool.query('UPDATE users SET username = $1, descripion = $2, image_id = $3 WHERE id = $4',
                [username, description, imageResult.rows[0].id, req.user.id]
            );
        }else{
            await pool.query('UPDATE users SET username = $1, descripion = $2 WHERE id = $3',
                [username, description, req.user.id]
            );
        }
        res.json({
            success: true
        });
    }catch(error){
        res.status(500).json({ success: false, error: "Error while inserting updating description" });
    }
}

async function getUser(req, res){
    try{
        const {rows} = await pool.query('SELECT u.id, u.username, u.description, i.img, i.public_id, i.resource_type FROM users u JOIN image i ON u.image_id=i.id WHERE u.id = $1;', [req.user.id]);
        
        res.json({
            success: true,
            result: rows
        });
    }catch(error){
        res.status(500).json({ success: false, error: "Error while getting user" });
    }
}

async function getUsers(req, res){
    const limit = parseInt(req.query.limit);
    const offset = parseInt(req.query.offset);
    try{
        const totalCountUsers = await pool.query('SELECT COUNT(*) FROM users;');
        const totalCount = parseInt(totalCountUsers.rows[0].count);

        if(offset > totalCount ){
            return res.status(400).json({success: false, error: 'Offset exceeds total number of users'});
        }

        const {rows} = await pool.query('SELECT u.id, u.username, u.description, i.img, i.public_id, i.resource_type FROM users u LEFT JOIN image i ON u.image_id=i.id ORDER BY u.id LIMIT $1 OFFSET $2;', [limit, offset]);
        
        res.json({
            totalCount: totalCount,
            success: true,
            result: rows
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function getFriends(req, res){
    const limit = parseInt(req.body.limit);
    const offset = parseInt(req.body.offset);
    try{
        const totalCountFriends = await pool.query('SELECT COUNT(*) FROM friends WHERE user_id = $1;', [req.user.id]);
        const totalCount = parseInt(totalCountFriends.rows[0].count);

        if(offset > totalCount ){
            return res.status(400).json({success: false, error: 'Offset exceeds total number of friends'});
        }

        const {rows} = await pool.query(`
            SELECT u.id, u.username, u.description, i.img, i.public_id, i.resource_type, f.status
            FROM friends f JOIN users u ON f.friend_id=u.id LEFT JOIN image i ON u.image_id=i.id 
            WHERE f.user_id = $1
            ORDER BY u.id 
            LIMIT $2 OFFSET $3;`, [req.user.id, limit, offset]);
        
        res.json({
            totalCount: totalCount,
            success: true,
            result: rows
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}
async function addFriend(req, res){
    const {friendId} = req.body;
    try{
        await pool.query("INSERT INTO friends(user_id, friend_id, status) VALUES ($1, $2,'pending');", [req.user.id, friendId]);
        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function handleFriendRequest(req, res){
    const {decision, userId} = req.body;
    try{
        if(decision){
            await pool.query("INSERT INTO friends(user_id, friend_id, status) VALUES ($1, $2,'accepted');", [userId, req.user.id]); //Accept the friend request from the other user
            res.json({
                success: true,
            });
        }else{
            await pool.query('DELETE FROM friends WHERE user_id = $1 AND friend_id = $2;', [userId, req.user.id]);
        }
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function deleteFriend(req, res){
    const {userId} = req.body;
    try{
        await pool.query("DELETE FROM friends WHERE user_id = $1 AND friend_id = $2;", [userId, req.user.id]);
        await pool.query("DELETE FROM friends WHERE user_id = $1 AND friend_id = $2;", [req.user.id, userId]);
        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function createGroup(req, res){
    //Ver que recibe members, estamos usando como si cada componente fuera un id
    //Puede que groupCreated lo este usando mal
    let groupCreated = null;
    const {groupname, description, members} = req.body;
    const file = req.file;
    try{
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
            groupCreated = await pool.query('INSERT INTO groups(name, description, image_id) VALUES ($1, $2, $3) RETURNING *;', [groupname, description, imageResult.id]);
        }else{
            groupCreated = await pool.query('INSERT INTO groups(name, description) VALUES ($1, $2) RETURNING *;', [groupname, description]);
        }
        await pool.query('INSERT INTO member(group_id, user_id, role) VALUES ($1, $2, "admin");', [groupCreated.rows[0].id, req.user.id]);
        if(members != null && members.length != 0){
            for(let i = 0; i < members.length; i++){
                await pool.query('INSERT INTO member(group_id, user_id, role) VALUES ($1, $2, "admin");', [rows[0].id, members[i]]);
            }
        }
        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function getGroup(req, res){
    const {groupId} = req.body;
    try{
        const {rows} = await pool.query(`SELECT * FROM groups g JOIN members m ON g.id = m.group_id 
            JOIN users u ON u.id = m.user_id
            WHERE g.id=$1;`,[groupId]);

        res.json({
            success: true,
            result: rows
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function updateGroup(req, res){
    const {groupId, groupname, description, addMembers, removeMembers} = req.body;
    const file = req.file;
    try{
        if(file != null){
            const {rows} = await pool.query('SELECT * FROM groups g JOIN image i ON g.image_id=i.id WHERE g.id = $1;', [groupId]);
            try{
                await cloudinary.v2.uploader.destroy(rows[0].public_id, {resource_type: rows[0].resource_type});
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
            await pool.query('UPDATE groups SET name=$1, description=$2, image_id=$3 WHERE id = $4;', [groupname, description, imageResult.id, groupId]);
        }else{
            await pool.query('UPDATE groups SET name=$1, description=$2 WHERE id = $3;', [groupname, description, groupId]);
        }

        if(addMembers != null && addMembers.length != 0){
            for(let i = 0; i < addMembers.length; i++){
                await pool.query('INSERT INTO member(group_id, user_id, role) VALUES ($1, $2, "normal");', [groupId, addMembers[i]]);
            }
        }

        if(removeMembers != null && removeMembers.length != 0){            
            for(let i = 0; i < removeMembers.length; i++){
                await pool.query('DELETE FROM member WHERE user_id=$1 AND group_id=$2', [removeMembers[i], groupId]);
            }
        }

        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function deleteGroup(req,res){
    const {groupId} = req.body;
    try{
        const {rows} = await pool.query('SELECT * FROM groups g JOIN image i ON g.image_id=i.id WHERE g.id=$1', [groupId]);
        try{
            await cloudinary.v2.uploader.destroy(rows[0].public_id, {resource_type: rows[0].resource_type});
        }catch(cloudinaryError){
            console.warn("Image not found in Cloudinary or deletion failer: ", cloudinaryError.message);
        }

        pool.query('DELETE FROM groups WHERE id = $1;', [groupId]);

        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function addMemberToGroup(req, res){
    const {userId, groupId} = req.body;
    try{
        await pool.query('INSERT INTO member(group_id, user_id, role) VALUES ($1, $2, "normal");', [groupId, userId]);
        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function deleteMemberFromGroup(req, res){
    const {userId, groupId} = req.body;
    try{
        await pool.query('DELETE FROM member WHERE user_id=$1 AND group_id=$2', [userId, groupId]);
        res.json({
            success: true,
        });
    }catch(error){
        res.status(500).json({ error: "Internal Server Error" });
    }
}

async function validUser(req, res) {
    if(req.user != null){
        return res.json({
            success: true,
            result: req.user
        });
    }else{
        return res.json({
            success: false,
            result: null
        });
    }
}

module.exports = {
    registerUser,
    loginUser,
    validUser,
    updateUser,
    getUser,
    getUsers,
    getFriends,
    addFriend,
    handleFriendRequest,
    deleteFriend,
    createGroup,
    getGroup,
    updateGroup,
    deleteGroup,
    addMemberToGroup,
    deleteMemberFromGroup
}


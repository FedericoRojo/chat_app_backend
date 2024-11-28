/*
3hs
User=(Name, description, image_id, hash TEXT NOT NULL, -- Hash of the passwordsalt TEXT NOT NULL -- Salt used for hashing)
Friends=(user_id, friend_id, status=(pending, accepted))
Message=(id, sender_id, receiver_id, timestamp, text, image_id(can be null))
Group=( id, name, description, image_id, timestamp)
Member=(group_id, user_id, role=(normal, admin))
GroupMessage=(id, group_id, sender_id, text, image_id, timestamp)
Image(id, img TEXT, public_id VARCHAR(255) NOT NULL,  resource_type VARCHAR(100) )
*/
const express = require("express");
const passport = require("passport");
const userRouter = require("./routes/userRouter.js");
const messageRouter = require("./routes/messageRouter.js");
const cors = require("cors");
require("dotenv").config();

var app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));

require('./config/passport')(passport);
app.use(passport.initialize());

app.use(cors());

app.use('/users', userRouter);
app.use('/messages', messageRouter);

const PORT = process.env.PORT || 3000;
app.listen( PORT, () => console.log(`App running on PORT ${PORT}`));

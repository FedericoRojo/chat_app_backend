const {Client} = require("pg");
require('dotenv').config();

const SQL = `

-- Image Table
CREATE TABLE image (
    id SERIAL PRIMARY KEY,
    img TEXT NOT NULL,
    public_id VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100)
);

-- User Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    description TEXT,
    image_id INT REFERENCES image(id) ON DELETE SET NULL,
    hash TEXT NOT NULL, -- Hash of the password
    salt TEXT NOT NULL  -- Salt used for hashing
);

-- Friends Table
CREATE TABLE friends (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(10) CHECK (status IN ('pending', 'accepted')) NOT NULL,
    PRIMARY KEY (user_id, friend_id)
);

-- Message Table
CREATE TABLE message (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    text TEXT NOT NULL,
    image_id INT REFERENCES image(id) ON DELETE SET NULL
);

-- Group Table
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_id INT REFERENCES image(id) ON DELETE SET NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Member Table
CREATE TABLE member (
    group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) CHECK (role IN ('normal', 'admin')) NOT NULL,
    PRIMARY KEY (group_id, user_id)
);

-- GroupMessage Table
CREATE TABLE groupmessage (
    id SERIAL PRIMARY KEY,
    group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    image_id INT REFERENCES image(id) ON DELETE SET NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);





`;

async function main(){
    console.log('seeding...');
    const client = new Client({
        connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
    });
    await client.connect();
    await client.query(SQL);
    await client.end();
    console.log('done');
}

main();
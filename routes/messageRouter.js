const {Router} = require("express");
const passport = require("passport");
const messageController = require('../controllers/messageController');

const messageRouter = Router();

messageRouter.get('/user', passport.authenticate("jwt", {session: false}), messageController.getUserChat);
messageRouter.get('/group', passport.authenticate("jwt", {session: false}), messageController.getGroupChat);
messageRouter.post('/user', passport.authenticate("jwt", {session: false}), messageController.createUserMessage);
messageRouter.post('/group',  passport.authenticate("jwt", {session: false}), messageController.createGroupMessage);
messageRouter.put('/user',  passport.authenticate("jwt", {session: false}), messageController.updateUserMessage);
messageRouter.put('/group',  passport.authenticate("jwt", {session: false}), messageController.updateGroupMessage);
messageRouter.delete('/user',  passport.authenticate("jwt", {session: false}), messageController.deleteMessage);
messageRouter.delete('/group',  passport.authenticate("jwt", {session: false}), messageController.deleteGroupMessage);


module.exports = messageRouter;
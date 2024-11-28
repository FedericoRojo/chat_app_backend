const {Router} = require("express");
const passport = require("passport");
const {upload} = require('./multerConfig.js');
const userController = require("../controllers/userController");
const {isAdmin} = require('../middleware/userMiddleware.js');

const userRouter = Router();

userRouter.post('/register', userController.registerUser);
userRouter.post('/login', userController.loginUser);
userRouter.post('/update', passport.authenticate("jwt", {session: false}), userController.updateUser);
userRouter.get('/me',  passport.authenticate("jwt", {session: false}), userController.getUser);
userRouter.get('/',  passport.authenticate("jwt", {session: false}), userController.getUsers);
userRouter.get('/friends', passport.authenticate("jwt", {session: false}), userController.getFriends);
userRouter.post('/friend', passport.authenticate("jwt", {session: false}), userController.addFriend);
userRouter.post('/friend/req', passport.authenticate("jwt", {session: false}), userController.handleFriendRequest);
userRouter.delete('/friend', passport.authenticate("jwt", {session: false}), userController.deleteFriend);
userRouter.post('/group', passport.authenticate("jwt", {session: false}), userController.createGroup);
userRouter.get('/group', passport.authenticate("jwt", {session: false}), userController.getGroup);
userRouter.put('/group', passport.authenticate("jwt", {session: false}), userController.updateGroup);
userRouter.delete('/group', passport.authenticate("jwt", {session: false}), userController.deleteGroup);
userRouter.post('/group/member', passport.authenticate("jwt", {session: false}), userController.addMemberToGroup);
userRouter.delete('/group/member', passport.authenticate("jwt", {session: false}), userController.deleteMemberFromGroup);
userRouter.get('/auth', passport.authenticate("jwt", {session: false}), userController.validUser);


//userRouter.get('/auth', passport.authenticate("jwt", {session: false}), userController.validUser);


module.exports = userRouter;
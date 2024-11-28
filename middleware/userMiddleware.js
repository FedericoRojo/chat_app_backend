function isAdmin(req, res, next){
    if( req.user  ){
        return next();
    }else{
        return res.status(403).json({message: 'Access denied'});
    }
}
module.exports = {isAdmin};
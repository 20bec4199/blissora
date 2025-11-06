class ErrorHandler extends Error {
    constructor(message, statusCode, flag) {
        super(message);
        this.statusCode = statusCode || 500;
        this.flag = flag || 'ERROR';    
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = ErrorHandler;
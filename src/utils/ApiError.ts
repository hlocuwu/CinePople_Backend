export class ApiError extends Error {
  statusCode: number;
  errors?: any; // Thêm trường optional để chứa lỗi validation

  constructor(statusCode: number, message: string, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    // Giữ stack trace
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
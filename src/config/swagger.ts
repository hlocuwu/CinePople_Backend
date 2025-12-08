import swaggerJsdoc from "swagger-jsdoc";
import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Ciné Booking API",
      version: "1.0.0",
      description: "API Documentation for Movie Ticket Booking App (Android)",
      contact: {
        name: "Backend Team",
      },
    },
    servers: [
      {
        url: "/",
        description: "Current Server",
      },
    ],
    // Cấu hình nút "Authorize" để nhập Token
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Đường dẫn tới các file chứa comment swagger
  apis: process.env.NODE_ENV === 'production'
    ? ["./dist/modules/**/controller.js", "./dist/modules/**/dto.js"] // Chạy trong Docker (JS)
    : ["./src/modules/**/*.ts"], // Chạy Local (TS) 
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log(`Swagger Docs available at http://localhost:${env.port || 5000}/api-docs`);
};
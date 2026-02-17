import { Request, Response } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import dotenv from "dotenv";

dotenv.config();

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Boomers API",
      description: "API endpoints for the boomers API documented on swagger",
      contact: {
        name: "Paul Otieno",
        email: "vitalispaul48@gmail.com",
        url: "https://github.com/Paulvitalis200/boomers-api/",
      },
      version: "1.0.0",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT}/`,
        description: "Local server",
      },
    ],
  },
  // looks for configuration in specified directories
  apis: ["./routes/*.ts", "./routes/team/*.ts", "./routes/challenges/*.ts"],
};
const swaggerSpec = swaggerJsdoc(options);
function swaggerDocs(app: any, port: any) {
  // Swagger Page
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  // Documentation in JSON format
  app.get("/api/docs.json", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
export default swaggerDocs;

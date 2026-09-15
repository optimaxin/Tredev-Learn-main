const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const cardRoutes = require("./routes/cardRoutes");
const errorHandler = require("./middlewares/errorHandler");

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/tarotdeck", express.static("images"));

app.use("/cards", cardRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "demo.html"));
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Tarot API running at http://localhost:${port}`);
  console.log(`Demo page: http://localhost:${port}/`);
});

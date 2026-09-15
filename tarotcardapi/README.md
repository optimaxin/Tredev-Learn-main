# 🔮 Tarot Card API

A free, open source Tarot Card API with **78 high resolution card images** and rich narrative interpretations. Built with Node.js and Express. No API keys. No rate limits. Just cards.

## 🌟 Features

- **Full 78 card deck.** Every Major and Minor Arcana card included.
- **High quality imagery.** Each card comes with its own JPEG artwork served straight from the API.
- **Random card endpoint.** Perfect for "card of the day" widgets or daily readings.
- **Rich interpretations.** Every card ships with a detailed, narrative style description.
- **Zero auth.** No API keys, no signup, no rate limits.
- **CORS enabled.** Call it directly from the browser.
- **Bundled live demo.** Open `http://localhost:3000/` after starting the server to see the interactive showcase.

## 🔮 Ideal for

- Tarot reading websites and apps
- Spiritual and astrological content creators
- Personal projects exploring divination and Tarot
- Educational purposes such as learning REST APIs or Tarot card meanings

## 🚀 Getting Started

```bash
git clone https://github.com/krates98/tarotcardapi.git
cd tarotcardapi
npm install
npm start
```

Then open **http://localhost:3000/** to see the live demo, or hit the API directly:

```bash
curl http://localhost:3000/cards/onecard
```

## 📡 Endpoints

| Method | Path                  | Description                                  |
| ------ | --------------------- | -------------------------------------------- |
| `GET`  | `/`                   | Interactive demo page                        |
| `GET`  | `/cards`              | Returns the entire 78 card deck              |
| `GET`  | `/cards/onecard`      | Returns a single random card                 |
| `GET`  | `/tarotdeck/:image`   | Serves the card artwork (e.g. `thefool.jpeg`)|

### Example response

```json
{
  "name": "The Fool",
  "description": "The Fool represents new beginnings, fresh starts, and stepping into the unknown with an open heart...",
  "image": "/tarotdeck/thefool.jpeg"
}
```

### Example usage

```js
const res = await fetch("http://localhost:3000/cards/onecard");
const card = await res.json();

console.log(card.name);   // "The Star"
console.log(card.image);  // "/tarotdeck/thestar.jpeg"
```

## 🧰 Tech stack

- [Express 5](https://expressjs.com/) for HTTP routing
- [CORS](https://www.npmjs.com/package/cors) for cross origin requests
- [dotenv](https://www.npmjs.com/package/dotenv) for environment configuration
- [nodemon](https://www.npmjs.com/package/nodemon) for auto restart in dev (`npm run dev`)

## 🤝 Contributing

Suggestions, improvements, and pull requests are welcome. Let's make this the best Tarot Card API out there.

## 📜 License

MIT © [krates98](https://github.com/krates98)

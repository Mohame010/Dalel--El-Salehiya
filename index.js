process.on("uncaughtException", (err) => {
  console.log("CRASH 💀", err);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR 💀", err);
});



const express = require("express");
const app = express();
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const axios = require("axios");
const fs = require("fs");

const SECRET = process.env.SECRET || "dalel_secret_key";

app.use(cors());
app.use(express.json());


// 🔥 create uploads folder if not exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("API running 🔥");
});



// ✅ DB CONNECTION (FIXED)
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
});

db.getConnection((err, conn) => {
  if (err) {
    console.log("DB ERROR ❌", err.message);
  } else {
    console.log("DB Connected 🔥");
    conn.release();
  }
});

const PORT = process.env.PORT || 3000;

console.log("BEFORE LISTEN 🔥");

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running 🔥");
});


// ================= 🔐 Middleware =================

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) return res.status(403).json("No Token ❌");

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).json("Invalid Token ❌");

    req.user = decoded;
    next();
  });
}

function isAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json("Admins only ❌");
  }
  next();
}


// ================= 🔐 Auth =================

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send("Missing data ❌");
  }

  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length > 0) {
      return res.send("User already exists ❌");
    }

    const hashed = await bcrypt.hash(password, 10);

    await db.promise().query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, hashed, "user"]
    );

    res.send("Registered Successfully 🔥");

  } catch (err) {
    console.log(err);
    res.status(500).send("Server error 💀");
  }
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0)
      return res.json({ success: false });

    const user = result[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.json({ success: false });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token, user });
  });
});


// ================= 📦 Upload =================

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "No file" });

  const imageUrl =
    req.protocol + "://" + req.get("host") + "/uploads/" + req.file.filename;

  res.json({ imageUrl });
});


// ================= 📂 Categories =================

app.post("/add-category", verifyToken, isAdmin, (req, res) => {
  const { name, image } = req.body;

  db.query(
    "INSERT INTO categories (name, image) VALUES (?, ?)",
    [name, image],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Added 🔥");
    }
  );
});

app.get("/categories", (req, res) => {
  db.query("SELECT * FROM categories", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

app.delete("/delete-category/:id", verifyToken, isAdmin, (req, res) => {
  db.query(
    "DELETE FROM categories WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Deleted 🔥");
    }
  );
});

app.put("/update-category/:id", verifyToken, isAdmin, (req, res) => {
  const { name, image } = req.body;

  db.query(
    "UPDATE categories SET name=?, image=? WHERE id=?",
    [name, image, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Updated 🔥");
    }
  );
});


// ================= 📢 Ads =================

app.post("/add-ad", verifyToken, isAdmin, (req, res) => {
  const { image, link } = req.body;

  db.query(
    "INSERT INTO ads (image, link) VALUES (?, ?)",
    [image, link],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Ad Added 🔥");
    }
  );
});

app.get("/ads", (req, res) => {
  db.query("SELECT * FROM ads", (err, result) => {
    res.json(result);
  });
});

app.delete("/delete-ad/:id", verifyToken, isAdmin, (req, res) => {
  db.query(
    "DELETE FROM ads WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Deleted 🔥");
    }
  );
});

app.put("/update-ad/:id", verifyToken, isAdmin, (req, res) => {
  db.query(
    "UPDATE ads SET link=? WHERE id=?",
    [req.body.link, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Updated 🔥");
    }
  );
});


// ================= 🏪 Places =================

app.post("/add-place", verifyToken, isAdmin, (req, res) => {
  const { name, image, address, phone, whatsapp, category_id } = req.body;

  db.query(
    `INSERT INTO places (name, image, address, phone, whatsapp, category_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, image, address, phone, whatsapp, category_id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Place Added 🔥");
    }
  );
});

app.get("/places/:category_id", (req, res) => {
  db.query(
    "SELECT * FROM places WHERE category_id = ?",
    [req.params.category_id],
    (err, result) => {
      res.json(result);
    }
  );
});

app.get("/all-places", (req, res) => {
  db.query("SELECT * FROM places", (err, result) => {
    res.json(result);
  });
});

app.delete("/delete-place/:id", verifyToken, isAdmin, (req, res) => {
  db.query(
    "DELETE FROM places WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Deleted 🔥");
    }
  );
});

app.put("/update-place/:id", verifyToken, isAdmin, (req, res) => {
  const { name, address, phone, whatsapp } = req.body;

  db.query(
    "UPDATE places SET name=?, address=?, phone=?, whatsapp=? WHERE id=?",
    [name, address, phone, whatsapp, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Updated 🔥");
    }
  );
});


// ================= 🍔 Items =================

app.post("/add-item", verifyToken, isAdmin, (req, res) => {
  const { name, price, image, place_id } = req.body;

  db.query(
    "INSERT INTO items (name, price, image, place_id) VALUES (?, ?, ?, ?)",
    [name, price, image, place_id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Item Added 🔥");
    }
  );
});

app.get("/items/:place_id", (req, res) => {
  db.query(
    "SELECT * FROM items WHERE place_id = ?",
    [req.params.place_id],
    (err, result) => {
      res.json(result);
    }
  );
});

app.get("/all-items", (req, res) => {
  db.query("SELECT * FROM items", (err, result) => {
    res.json(result);
  });
});

app.delete("/delete-item/:id", verifyToken, isAdmin, (req, res) => {
  db.query(
    "DELETE FROM items WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Deleted 🔥");
    }
  );
});

app.put("/update-item/:id", verifyToken, isAdmin, (req, res) => {
  const { name, price } = req.body;

  db.query(
    "UPDATE items SET name=?, price=? WHERE id=?",
    [name, price, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Updated 🔥");
    }
  );
});

app.get("/items-with-place", (req, res) => {
  const sql = `
    SELECT items.*, places.name AS place_name
    FROM items
    JOIN places ON items.place_id = places.id
  `;

  db.query(sql, (err, result) => {
    if (err) return res.send(err);
    res.json(result);
  });
});


// ================= 👤 Users =================





app.get("/users", verifyToken, isAdmin, (req, res) => {
  db.query("SELECT * FROM users", (err, result) => {
    res.json(result);
  });
});

app.delete("/delete-user/:id", verifyToken, isAdmin, (req, res) => {
  db.query(
    "DELETE FROM users WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Deleted 🔥");
    }
  );
});

app.put("/update-user/:id", verifyToken, isAdmin, (req, res) => {
  const { username, role } = req.body;

  db.query(
    "UPDATE users SET username=?, role=? WHERE id=?",
    [username, role, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Updated 🔥");
    }
  );
});


app.post("/add-user", async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).send("Missing data ❌");
  }

  try {
    // 🔍 check duplicate
    const [rows] = await db.promise().query(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (rows.length > 0) {
      return res.send("User already exists ❌");
    }

    // 🔐 hash password
    const bcrypt = require("bcrypt");
    const hashed = await bcrypt.hash(password, 10);

    await db.promise().query(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, hashed, role]
    );

    res.send("User Added 🔥");

  } catch (err) {
    console.log(err);
    res.status(500).send("Server error 💀");
  }
});

// ================= 📊 Stats =================

app.get("/stats", verifyToken, isAdmin, (req, res) => {
  const stats = {};

  db.query("SELECT COUNT(*) as count FROM categories", (e, c) => {
    stats.categories = c[0].count;

    db.query("SELECT COUNT(*) as count FROM places", (e, p) => {
      stats.places = p[0].count;

      db.query("SELECT COUNT(*) as count FROM items", (e, i) => {
        stats.items = i[0].count;

        res.json(stats);
      });
    });
  });
});



// ================= 🔔Notification =================


app.post("/save-settings", (req, res) => {
  const { appId, apiKey } = req.body;

  db.query("DELETE FROM settings");

  db.query(
    "INSERT INTO settings (onesignal_app_id, onesignal_api_key) VALUES (?, ?)",
    [appId, apiKey],
    (err) => {
      if (err) return res.send(err);
      res.send("Saved 🔥");
    }
  );
});

app.get("/settings", (req, res) => {
  db.query("SELECT * FROM settings LIMIT 1", (err, result) => {
    res.json(result[0] || {});
  });
});


app.post("/send-notification", async (req, res) => {

  const { title, message, image, url, openType, schedule } = req.body;

  db.query("SELECT * FROM settings LIMIT 1", async (err, result) => {

    const settings = result[0];

    // 🕒 Schedule
    if (schedule) {
      db.query(
        `INSERT INTO notifications 
        (title, message, image, url, open_type, status, scheduled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, message, image, url, openType, "scheduled", schedule]
      );

      return res.send("Scheduled 🔥");
    }

    // 🔥 Send Now
    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      {
        app_id: settings.onesignal_app_id,
        included_segments: ["All"],
        headings: { en: title },
        contents: { en: message },
        big_picture: image,
        data: { url, openType }
      },
      {
        headers: {
          "Authorization": "Basic " + settings.onesignal_api_key,
        },
      }
    );

    const recipients = response.data.recipients;

    db.query(
      `INSERT INTO notifications 
      (title, message, image, url, open_type, recipients, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, message, image, url, openType, recipients, "sent"]
    );

    res.json({ success: true, recipients });
  });
});

app.get("/notifications-history", (req, res) => {
  db.query("SELECT * FROM notifications ORDER BY id DESC", (err, result) => {
    res.json(result);
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running 🔥");
});


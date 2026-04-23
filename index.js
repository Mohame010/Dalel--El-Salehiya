process.on("uncaughtException", (err) => {
  console.log("CRASH 💀", err);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR 💀", err);
});



require("dotenv").config();

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

// const cors = require("cors");

app.use(cors({
  origin: "*"
}));
app.use(express.json());
app.set("trust proxy", true);


// 🔥 create uploads folder if not exists
const uploadPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

app.use("/uploads", express.static(uploadPath));

app.get("/", (req, res) => {
  res.send("انا شغال يا حبيب اخوك🔥⭐");
});



// ✅ DB CONNECTION (FIXED)
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQL_DATABASE, // تأكد من وجود الـ _ هنا إذا كانت موجودة في Variables
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

// 1. تحديد الـ Port مع الأولوية لمتغير البيئة الخاص بـ Railway
const PORT = process.env.PORT || 3000;

// 2. تشغيل السيرفر فوراً (عشان Railway يحس إنه شغال وما يقفلوش)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is active on port ${PORT}`);
  
  // 3. تجربة الاتصال بقاعدة البيانات بعد تشغيل السيرفر
  db.query("SELECT 1", (err) => {
    if (err) {
      console.log("❌ DB Connection Error:", err.message);
    } else {
      console.log("🔥 DB Connected Successfully");
    }
  });
});

// ================= 🔐 Middleware =================

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(403).json("No Token ❌");
  }

  /// 🔥 FIX هنا
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  if (!token) {
    return res.status(403).json("Invalid Token Format ❌");
  }

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
  const { name, phone, password } = req.body;

  // 🔥 Validation
  if (!name || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: "Missing data ❌"
    });
  }

  try {
    // 🔍 Check duplicate phone
    const [rows] = await db.promise().query(
      "SELECT * FROM users WHERE phone = ?",
      [phone]
    );

    if (rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Phone already exists ❌"
      });
    }

    // 🔐 Hash password
    const hashed = await bcrypt.hash(password, 10);

    // 💾 Insert user
    await db.promise().query(
      "INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)",
      [name, phone, hashed, "user"]
    );

    // ✅ Success
    res.json({
      success: true,
      message: "Registered Successfully 🔥"
    });

  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server error 💀"
    });
  }
});


app.post("/login", async (req, res) => {
  const { phone, username, password } = req.body;

  // 🔥 Validation
  if ((!phone && !username) || !password) {
    return res.status(400).json({
      success: false,
      message: "Missing data ❌"
    });
  }

  try {
    // 🔍 نحدد هنستخدم phone ولا username
    const value = phone || username;

    // 🔍 نبحث عن المستخدم
    const [rows] = await db.promise().query(
      "SELECT * FROM users WHERE phone = ? OR username = ?",
      [value, value]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User not found ❌"
      });
    }

    const user = rows[0];

    // 🔐 مقارنة الباسورد
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Wrong password ❌"
      });
    }

    // 🔑 إنشاء التوكن
    const token = jwt.sign(
      { id: user.id, role: user.role },
      SECRET,
      { expiresIn: "7d" }
    );

    // ✅ نجاح
    res.json({
      success: true,
      token,
      user
    });

  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Server error 💀"
    });
  }
});



// ================= 🚌transport_routes =================

app.post("/add-route", verifyToken, isAdmin, (req, res) => {
  const { type, from_location, to_location, price, category_id, time } = req.body;

  db.query(
    "INSERT INTO transport_routes (type, from_location, to_location, price, category_id, time) VALUES (?, ?, ?, ?, ?, ?)",
    [type, from_location, to_location, price, category_id, time],
    (err) => {
      if (err) {
        console.log("SQL ERROR ❌", err);
        return res.status(500).json(err);
      }

      res.json({ success: true, message: "Route Added 🔥" });
    }
  );
});

app.get("/routes", (req, res) => {
  db.query("SELECT * FROM transport_routes", (err, result) => {
    res.json(result);
  });
});

app.delete("/delete-route/:id", verifyToken, isAdmin, (req, res) => {
  db.query(
    "DELETE FROM transport_routes WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json("Deleted 🔥");
    }
  );
});


app.put("/update-route/:id", verifyToken, isAdmin, (req, res) => {
  const { type, from_location, to_location, price, category_id, time } = req.body;

  db.query(
    "UPDATE transport_routes SET type=?, from_location=?, to_location=?, price=?, category_id=?, time=? WHERE id=?",
    [type, from_location, to_location, price, category_id, time, req.params.id],
    (err) => {
      if (err) {
        console.log("UPDATE ERROR ❌", err);
        return res.status(500).json(err);
      }

      res.json({ success: true, message: "Updated 🔥" });
    }
  );
});

app.get("/routes-by-category/:id", (req, res) => {
  db.query(
    "SELECT * FROM transport_routes WHERE category_id = ?",
    [req.params.id],
    (err, result) => {
      res.json(result);
    }
  );
});


// ================= 📦 Upload =================
// ✅ إعداد multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

// ✅ Route الرفع
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file" });
  }

  const imageUrl =
  (req.headers["x-forwarded-proto"] || req.protocol) +
  "://" +
  req.get("host") +
  "/uploads/" +
  req.file.filename;

  console.log("Saved file:", req.file.path);

  res.status(200).json({
    message: "Upload successful",
    url: imageUrl,
  });
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
  const { 
    name, image, address, phone, whatsapp, category_id,
    open_time, close_time, working_days
  } = req.body;

  db.query(
    `INSERT INTO places 
    (name, image, address, phone, whatsapp, category_id, open_time, close_time, working_days)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, image, address, phone, whatsapp, category_id, open_time, close_time, working_days],
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


app.delete("/delete-my-account", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // 🧹 لو عندك بيانات مرتبطة بالمستخدم احذفها هنا
    // مثال:
    // await db.promise().query("DELETE FROM favorites WHERE user_id = ?", [userId]);
    // await db.promise().query("DELETE FROM orders WHERE user_id = ?", [userId]);

    // ❌ حذف المستخدم
    await db.promise().query(
      "DELETE FROM users WHERE id = ?",
      [userId]
    );

    res.json({
      success: true,
      message: "Account deleted successfully 🔥"
    });

  } catch (err) {
    console.log("DELETE ACCOUNT ERROR ❌", err);

    res.status(500).json({
      success: false,
      message: "Server error 💀"
    });
  }
});



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
  const { appId, apiKey, requireLogin } = req.body;

  db.query("DELETE FROM settings");

  db.query(
    "INSERT INTO settings (onesignal_app_id, onesignal_api_key, require_login) VALUES (?, ?, ?)",
    [appId, apiKey, requireLogin ? 1 : 0],
    (err) => {
      if (err) return res.send(err);

      res.send("Saved 🔥");
    }
  );
});

app.get("/settings", (req, res) => {
  db.query("SELECT * FROM settings LIMIT 1", (err, result) => {
    if (err) {
      return res.status(500).json({ success: false });
    }

    const settings = result[0] || {};

    res.json({
      success: true,
      require_login: settings.require_login === 1
    });
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



const checkNotifications = async () => {
  try {
    const [notifications] = await db.promise().query(
      "SELECT * FROM notifications WHERE status='scheduled' AND scheduled_at <= NOW()"
    );

    if (!notifications.length) return;

    const [settings] = await db.promise().query("SELECT * FROM settings LIMIT 1");
    const s = settings[0];
    if (!s) return;

    for (let n of notifications) {
      try {
        const response = await axios.post(
          "https://onesignal.com/api/v1/notifications",
          {
            app_id: s.onesignal_app_id,
            included_segments: ["All"],
            headings: { en: n.title },
            contents: { en: n.message },
            big_picture: n.image,
            data: { url: n.url, openType: n.open_type }
          },
          {
            headers: {
              "Authorization": "Basic " + s.onesignal_api_key
            },
            timeout: 10000,
          }
        );

        await db.promise().query(
          "UPDATE notifications SET status='sent', recipients=? WHERE id=?",
          [response.data.recipients || 0, n.id]
        );

      } catch (error) {
        console.error(`Error sending notification ${n.id}:`, error.message);
      }
    }

  } catch (err) {
    console.error("Cron Job Error ❌", err);
  } finally {
    setTimeout(checkNotifications, 30000);
  }
};

checkNotifications();


app.get("/", (req, res) => {
  res.send("Backend is running 🔥");
});




app.get("/search", async (req, res) => {
  const q = req.query.q;

  if (!q) {
    return res.json({ success: true, places: [], items: [] });
  }

  const search = `%${q}%`;

  try {
    // 🔍 البحث في الأماكن
    const [places] = await db.promise().query(
      "SELECT * FROM places WHERE name LIKE ?",
      [search]
    );

    // 🔍 البحث في المنتجات
    const [items] = await db.promise().query(
      "SELECT * FROM items WHERE name LIKE ?",
      [search]
    );

    res.json({
      success: true,
      places,
      items,
    });

  } catch (err) {
    console.log("SEARCH ERROR ❌", err);

    res.status(500).json({
      success: false,
      message: "Search failed 💀"
    });
  }
});

// ================= 🌟⭐ =================


app.post("/rate", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { place_id, rating } = req.body;

  try {
    await db.promise().query(
      "INSERT INTO ratings (user_id, place_id, rating) VALUES (?, ?, ?)",
      [userId, place_id, rating]
    );

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json("error");
  }
});


app.get("/place-rating/:place_id", async (req, res) => {
  const placeId = req.params.place_id;

  try {
    const [rows] = await db.promise().query(
      `
      SELECT 
        IFNULL(AVG(rating), 0) AS rating,
        COUNT(*) AS count
      FROM ratings
      WHERE place_id = ?
      `,
      [placeId]
    );

    res.json(rows[0]);

  } catch (err) {
    console.log(err);
    res.status(500).json("error");
  }
});


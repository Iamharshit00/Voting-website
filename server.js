import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER        = process.env.OWNER;
const REPO         = process.env.REPO;
const FILE_PATH    = process.env.FILE_PATH || "data.json";
const PORT         = process.env.PORT || 3000;

/* ---------- helpers ---------- */
const ghHeaders = {
  Authorization: `token ${GITHUB_TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "EVM-Server",
};

async function ghGet() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const res = await fetch(url, { headers: ghHeaders });
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const data = await res.json();
  return {
    content: JSON.parse(Buffer.from(data.content, "base64").toString()),
    sha: data.sha,
  };
}

async function ghPut(content, sha) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: ghHeaders,
    body: JSON.stringify({
      message: `EVM data update — ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(content, null, 2)).toString("base64"),
      sha,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `GitHub PUT ${res.status}`);
  }
  return res.json();
}

/* ---------- routes ---------- */

// GET — fetch latest data from GitHub
app.get("/data", async (req, res) => {
  try {
    const { content } = await ghGet();
    res.json(content);
  } catch (err) {
    console.error("GET /data error:", err.message);
    res.status(502).json({ error: "Failed to fetch from GitHub", detail: err.message });
  }
});

// POST — push updated data to GitHub
app.post("/update", async (req, res) => {
  try {
    const { sha } = await ghGet();
    await ghPut(req.body, sha);
    res.json({ success: true });
  } catch (err) {
    console.error("POST /update error:", err.message);
    res.status(502).json({ error: "Failed to push to GitHub", detail: err.message });
  }
});

// Health check
app.get("/ping", (req, res) => res.json({ status: "ok", time: Date.now() }));

app.listen(PORT, () => {
  console.log(`\n  EVM Server running → http://localhost:${PORT}`);
  console.log(`  Syncing with github.com/${OWNER}/${REPO}/${FILE_PATH}\n`);
});
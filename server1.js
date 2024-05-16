const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const csv = require("csv-parser");
const { parse } = require("csv-parse");
const { createObjectCsvWriter } = require("csv-writer");
const crypto = require("crypto");
const session = require("express-session");
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

const usersFilePath = "users.csv"; // Path to your users.csv
const csvFilePath = "workspaces.csv";
const tokensFilePath = "tokens.csv";

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

// Load users from CSV
function loadUsers() {
  return new Promise((resolve, reject) => {
    const users = [];
    fs.createReadStream(usersFilePath)
      .pipe(csv())
      .on("data", (row) => users.push(row))
      .on("end", () => {
        resolve(users);
      });
  });
}

// Serve the login page

// Handle login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const users = await loadUsers();

  const user = users.find((u) => u.username === username);
  if (!user) {
    return res.status(401).send("User not found");
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (passwordMatch) {
    req.session.isAuthenticated = true;
    res.redirect("/index1.html"); // Redirect to workspace management after successful login
  } else {
    res.status(401).send("Invalid password");
  }
});

// Load workspaces from CSV

///
function loadWorkspaces(callback) {
  fs.readFile(csvFilePath, (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return callback([]);
    }
    parse(data, { columns: true }, (err, records) => {
      if (err) {
        console.error("Error parsing CSV:", err);
        return callback([]);
      }
      callback(records);
    });
  });
}

// Save workspaces to CSV

// Load tokens from CSV
function loadTokens(callback) {
  fs.readFile(tokensFilePath, (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return callback([]);
    }
    parse(data, { columns: true }, (err, records) => {
      if (err) {
        console.error("Error parsing CSV:", err);
        return callback([]);
      }
      callback(records);
    });
  });
}

///
function saveWorkspaces(workspaces, callback) {
  const csvWriter = createObjectCsvWriter({
    path: csvFilePath,
    header: [
      { id: "id", title: "id" },
      { id: "title", title: "title" },
      { id: "description", title: "description" },
    ],
  });
  csvWriter.writeRecords(workspaces).then(() => {
    callback();
  });
}

function saveTokens(tokens, callback) {
  const csvWriter = createObjectCsvWriter({
    path: tokensFilePath,
    header: [
      { id: "id", title: "id" },
      { id: "workspaceId", title: "workspaceId" },
      { id: "name", title: "name" },
      { id: "token", title: "token" },
      { id: "createdAt", title: "createdAt" },
      { id: "revokedAt", title: "revokedAt" },
    ],
  });
  csvWriter.writeRecords(tokens).then(() => {
    callback();
  });
}

///
app.get("/api/workspaces", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).send("Unauthorized");
  }
  loadWorkspaces((workspaces) => {
    res.json(workspaces);
  });
});

// API to get a single workspace and its tokens
app.get("/api/workspaces/:id", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).send("Unauthorized");
  }
  loadWorkspaces((workspaces) => {
    const workspace = workspaces.find((ws) => ws.id === req.params.id);
    if (!workspace) {
      res.status(404).send("Workspace not found");
      return;
    }
    loadTokens((tokens) => {
      const workspaceTokens = tokens.filter(
        (t) => t.workspaceId === req.params.id && !t.revokedAt
      );
      res.json({
        workspace,
        tokens: workspaceTokens.map((t) => ({
          id: t.id,
          name: t.name,
          token: t.token, // Ensure this maps the CSV column name
          createdAt: t.createdAt,
          revokedAt: t.revokedAt,
        })),
      });
    });
  });
});

app.post("/api/workspaces/:id/tokens", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).send("Unauthorized");
  }
  const { name } = req.body;
  loadTokens((tokens) => {
    const newToken = {
      id: crypto.randomUUID(),
      workspaceId: req.params.id,
      name,
      token: crypto.randomBytes(20).toString("hex"),
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    tokens.push(newToken);
    saveTokens(tokens, () => {
      res.status(201).json({
        id: newToken.id,
        name: newToken.name,
        createdAt: newToken.createdAt,
      });
    });
  });
});

// Save tokens to CSV

// API to get all workspaces

// API to create a workspace

///
app.post("/api/workspaces", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).send("Unauthorized");
  }
  const { title, description } = req.body;
  loadWorkspaces((workspaces) => {
    const newWorkspace = {
      id: crypto.randomUUID(),
      title,
      description,
    };
    workspaces.push(newWorkspace);

    saveWorkspaces(workspaces, () => {
      res.status(201).json(newWorkspace);
    });
  });
});

// API to create a token for a workspace

// API to update a workspace
app.put("/api/workspaces/:id", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).send("Unauthorized");
  }
  const { title, description } = req.body;
  loadWorkspaces((workspaces) => {
    const index = workspaces.findIndex((ws) => ws.id === req.params.id);
    if (index === -1) {
      res.status(404).send("Workspace not found");
      return;
    }
    workspaces[index].title = title;
    workspaces[index].description = description;
    saveWorkspaces(workspaces, () => {
      res.status(200).json(workspaces[index]);
    });
  });
});

app.patch("/api/tokens/:id/revoke", (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).send("Unauthorized");
  }
  loadTokens((tokens) => {
    const tokenIndex = tokens.findIndex((t) => t.id === req.params.id);
    if (tokenIndex === -1) {
      res.status(404).send("Token not found");
      return;
    }
    tokens[tokenIndex].revokedAt = new Date().toISOString(); // Mark the token as revoked
    saveTokens(tokens, () => {
      res.status(200).send("Token revoked");
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

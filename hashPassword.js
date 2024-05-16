const bcrypt = require("bcrypt");

async function hashPassword() {
  const saltRounds = 10;
  const passwords = ["skills2023d1", "skills2023d2"];
  for (const password of passwords) {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log(`Hashed password for ${password}: ${hashedPassword}`);
  }
}

hashPassword();

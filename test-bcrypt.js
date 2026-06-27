async function test() {
  try {
    const bcrypt = await import('./bcrypt.js');
    const pass = "12345";
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(pass, salt);
    console.log("Hash:", hash);
    const isMatch = bcrypt.compareSync(pass, hash);
    console.log("Match:", isMatch);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();

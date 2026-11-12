function requireAuthority(req, res, next) {
  const expectedKey = process.env.AUTHORITY_ACCESS_KEY || 'applyus-admin-2026';
  const providedKey = req.headers['x-authority-key'] || req.query.key;

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing Authority Access Key.',
    });
  }
  next();
}

module.exports = { requireAuthority };


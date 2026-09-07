import fs from 'fs';

const filePath = './server/routes.ts';
let code = fs.readFileSync(filePath, 'utf-8');

const target = `  app.post(api.searchHistory.create.path, async (req, res) => {`;

const newRoutes = `  app.delete(api.searchHistory.delete.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.sendStatus(400);
      await db.delete(searchHistory).where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)));
      res.sendStatus(204);
    } catch (err) {
      console.error(err);
      res.sendStatus(500);
    }
  });

  app.delete(api.searchHistory.clear.path, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.sendStatus(401);
    try {
      await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
      res.sendStatus(204);
    } catch (err) {
      console.error(err);
      res.sendStatus(500);
    }
  });

  app.post(api.searchHistory.create.path, async (req, res) => {`;

code = code.replace(target, newRoutes);
fs.writeFileSync(filePath, code);

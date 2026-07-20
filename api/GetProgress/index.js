const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
  const userId = req.query.userId || (req.body && req.body.userId);

  if (!userId) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'userId is required' }
    };
    return;
  }

  try {
    // 从环境变量读取 Cosmos DB 配置
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseId = process.env.COSMOS_DATABASE || 'flashcards-db';
    const containerId = process.env.COSMOS_CONTAINER || 'progress';

    // 如果没有配置 Cosmos DB，返回空数据（允许离线模式）
    if (!connectionString) {
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          userId,
          items: [],
          message: 'Cosmos DB not configured, returning empty progress'
        }
      };
      return;
    }

    const client = new CosmosClient(connectionString);
    const database = client.database(databaseId);
    const container = database.container(containerId);

    const query = {
      query: 'SELECT * FROM c WHERE c.userId = @userId',
      parameters: [{ name: '@userId', value: userId }]
    };

    const { resources } = await container.items.query(query).fetchAll();

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        userId,
        items: resources
      }
    };
  } catch (error) {
    context.log.error('GetProgress error:', error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: 'Failed to fetch progress', details: error.message }
    };
  }
};

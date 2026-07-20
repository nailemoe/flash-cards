const { CosmosClient } = require('@azure/cosmos');

module.exports = async function (context, req) {
  const body = req.body;

  if (!body || !body.userId || !body.wordId) {
    context.res = {
      status: 400,
      body: { error: 'userId and wordId are required' }
    };
    return;
  }

  try {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    const databaseId = process.env.COSMOS_DATABASE || 'flashcards-db';
    const containerId = process.env.COSMOS_CONTAINER || 'progress';

    // 如果没有配置 Cosmos DB，直接返回成功
    if (!connectionString) {
      context.res = {
        status: 200,
        body: {
          success: true,
          message: 'Cosmos DB not configured, update skipped'
        }
      };
      return;
    }

    const client = new CosmosClient(connectionString);
    const database = client.database(databaseId);
    const container = database.container(containerId);

    // 构造文档 ID
    const documentId = `${body.userId}_${body.wordId}`;

    // 分区键为 /word，需在文档中包含 word 字段
    const item = {
      id: documentId,
      word: body.word,
      userId: body.userId,
      wordId: body.wordId,
      category: body.category,
      proficiency: body.proficiency,
      reviewCount: body.reviewCount,
      correctCount: body.correctCount,
      lastReviewed: body.lastReviewed,
      nextReview: body.nextReview,
      intervalDays: body.intervalDays,
      ease: body.ease,
      difficulty: body.difficulty || 'normal'
    };

    await container.items.upsert(item, { partitionKey: body.word });

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        success: true,
        id: documentId
      }
    };
  } catch (error) {
    context.log.error('UpdateProgress error:', error);
    context.res = {
      status: 500,
      body: { error: 'Failed to update progress', details: error.message }
    };
  }
};

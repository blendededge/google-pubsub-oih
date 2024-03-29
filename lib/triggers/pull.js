/* eslint-disable no-shadow */
const { wrapper } = require('@blendededge/ferryman-extensions');

// Imports the Google Cloud client library
const { v1 } = require('@google-cloud/pubsub');

async function synchronousPull(self, subClient, projectId, subscriptionName, topicName) {
  const formattedSubscription = subClient.subscriptionPath(
    projectId,
    subscriptionName,
  );

  try {
    await subClient.getSubscription({ subscription: formattedSubscription });
  } catch (err) {
    self.logger.debug('About to get subscription');
    if (err.message.includes('NOT_FOUND')) {
      self.logger.debug('Subscription was not found. About to create subscription');
      await subClient.createSubscription({ topic: topicName, name: formattedSubscription });
    } else {
      throw err;
    }
  }

  // The subscriber pulls a specified number of messages.
  const [response] = await subClient.pull({
    subscription: formattedSubscription,
    maxMessages: 100,
    returnImmediately: true,
  });
  self.logger.info(`Total messages received: ${response.receivedMessages.length}`);
  if (response.receivedMessages.length === 0) {
    await self.emit('end');
    return;
  }
  // Process the messages.
  const ackIds = [];
  let newMsg;
  // eslint-disable-next-line no-restricted-syntax
  for (const message of response.receivedMessages) {
    self.logger.info(`Message received with ID: ${message.message.messageId}`);
    ackIds.push(message.ackId);
    newMsg = { data: message.message.data.toString() };
    newMsg.headers = message.message.attributes || {};
    newMsg.id = message.message.messageId;
    if (message.message.publishTime) {
      newMsg.headers.publishTime = message.message.publishTime;
    }
    // eslint-disable-next-line no-await-in-loop
    await self.emit('data', newMsg);
  }
  // Acknowledge all of the messages. You could also acknowledge
  // these individually, but this is more efficient.
  if (ackIds.length) {
    const ackRequest = {
      subscription: formattedSubscription,
      ackIds,
    };
    self.logger.debug('Acknowledging retrieved messages...');
    subClient.acknowledge(ackRequest);
  }
}

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``data`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
async function processAction(msg, cfg, snapshot, headers, tokenData) {
  let self = this;

  try {
    self = await wrapper(this, msg, cfg, snapshot, headers, tokenData);
    self.logger.info('Start pull trigger');

    const { projectId, topicName } = cfg;
    const subscriptionName = `eio_${process.env.ELASTICIO_TASK_ID}`;

    const subClient = new v1.SubscriberClient({
      credentials: {
        client_email: cfg.client_email,
        private_key: cfg.private_key,
      },
    });

    await synchronousPull(self, subClient, projectId, subscriptionName, topicName);
  } catch (err) {
    self.emit('error', err);
    self.logger.error(`Oops! Error occurred: ${err}`);
  }
}

module.exports.process = processAction;

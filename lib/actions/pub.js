const { wrapper } = require('@blendededge/ferryman-extensions');

// Imports the Google Cloud client library
const { PubSub } = require('@google-cloud/pubsub');

let pubsubClient;
let topic;

const { CLIENT_CACHE_DISABLED } = process.env;
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
    self.logger.info('Start publish action');
    const { projectId, topicName } = cfg;

    if (!pubsubClient || !topic || (CLIENT_CACHE_DISABLED && CLIENT_CACHE_DISABLED === 'true')) {
      // Lazy initialization
      pubsubClient = new PubSub({
        projectId,
        credentials: {
          client_email: cfg.client_email,
          private_key: cfg.private_key,
        },
      });
      topic = pubsubClient.topic(topicName);
    }

    // Google PubSub expects the payload to be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object

    let bufferData;
    if ((typeof msg.data === 'object' || typeof msg.data === 'function') && (msg.data !== null)) {
      bufferData = JSON.stringify(msg.data);
      if (msg.data instanceof Buffer) {
        // eslint-disable-next-line no-use-before-define
        bufferData = Buffer.from(JSON.parse(bufferData).data);
      } else {
        bufferData = Buffer.from(bufferData);
      }
    } else {
      bufferData = Buffer.from(msg.data.toString());
    }

    const messageId = await topic.publish(bufferData);
    const data = {
      messageID: [messageId],
    };
    self.logger.info('Message sent with ID:', messageId);
    await self.emit('data', { data });

    self.logger.info('Finished execution');
    await self.emit('end');
  } catch (err) {
    await self.emit('error', err);
    self.logger.error(`Oops! Error occurred: ${err}`);
  }
}

module.exports.process = processAction;

/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const sinon = require('sinon');
const { PubSub } = require('@google-cloud/pubsub');
const { process: processFunction } = require('../lib/actions/pub'); // Replace with your actual file name

describe('processAction pub', () => {
  let mockSelf; let mockEmit; let mockLogger; let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockEmit = sandbox.stub();
    mockLogger = sandbox.stub();
    mockSelf = {
      emit: mockEmit,
      logger: {
        info: mockLogger,
        child: () => mockSelf.logger,
      },
    };
    sandbox.stub(PubSub.prototype, 'topic');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('successfully sends message', async () => {
    const msg = { data: 'testData' };
    const cfg = {
      projectId: 'testProject',
      topicName: 'testTopic',
      client_email: 'test@test.com',
      private_key: 'testPrivateKey',
    };

    const mockTopic = {
      publish: sandbox.stub().resolves('123'),
    };

    PubSub.prototype.topic = sandbox.stub().returns(mockTopic);

    await processFunction.call(mockSelf, msg, cfg);

    const actualBuffer = mockTopic.publish.getCall(0).args[0];
    expect(actualBuffer).to.be.an.instanceOf(Buffer);
    expect(actualBuffer.toString()).to.equal('testData'); // Converting Buffer back to string for comparison
    const expectedData = {
      id: sinon.match.string,
      attachments: {},
      data: { messageID: ['123'] },
      headers: {},
      metadata: sinon.match.object,
    };
    expect(mockEmit.calledWith('data', sinon.match(expectedData))).to.be.true;
    expect(mockEmit.calledWith('end')).to.be.true;
    expect(mockLogger.calledWith('Message sent with ID:', '123')).to.be.true;
  });

  it('fails and emits error', async () => {
    const msg = { data: 'testData' };
    const cfg = {
      projectId: 'testProject',
      topicName: 'testTopic',
      client_email: 'test@test.com',
      private_key: 'testPrivateKey',
    };

    const error = new Error('Failed');
    const mockTopic = {
      publish: sandbox.stub().rejects(error),
    };

    PubSub.prototype.topic = sandbox.stub().returns(mockTopic);

    await processFunction.call(mockSelf, msg, cfg);

    const actualBuffer = mockTopic.publish.getCall(0).args[0];
    expect(actualBuffer).to.be.an.instanceOf(Buffer);
    expect(actualBuffer.toString()).to.equal('testData'); // Converting Buffer back to string for comparison
    expect(mockEmit.calledWith('error', error)).to.be.true;
    expect(mockLogger.calledWith('Oops! Error occurred')).to.be.true;
  });
});

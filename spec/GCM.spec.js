import log from 'npmlog';
import GCM from '../src/GCM.js';

function mockSender(gcm) {
  return spyOn(gcm.sender, 'send').and.callFake(function(message, options, timeout, cb) {
    /*{  "multicast_id":7680139367771848000,
      "success":0,
      "failure":4,
      "canonical_ids":0,
      "results":[ {"error":"InvalidRegistration"},
        {"error":"InvalidRegistration"},
        {"error":"InvalidRegistration"},
        {"error":"InvalidRegistration"}] }*/

    const tokens = options.registrationTokens;
    const response = {
      multicast_id: 7680139367771848000,
      success: tokens.length,
      failure: 0,
      cannonical_ids: 0,
      results: tokens.map((token, index) => {
        return {
          message_id: 7680139367771848000 + '' + index,
          registration_id: token
        }
      })
    }
    process.nextTick(() => {
      cb(null, response);
    });
  });
}

describe('GCM', () => {
  it('can initialize', (done) => {
    const args = {
      apiKey: 'apiKey'
    };
    const gcm = new GCM(args);
    expect(gcm.sender.key).toBe(args.apiKey);
    done();
  });

  it('can throw on initializing with invalid args', (done) => {
    let args = 123
    expect(function() {
      new GCM(args);
    }).toThrow();
    args = {
      apisKey: 'apiKey'
    };
    expect(function() {
      new GCM(args);
    }).toThrow();
    args = undefined;
    expect(function() {
      new GCM(args);
    }).toThrow();
    done();
  });

  it('does log on invalid APNS notification', async () => {
    const spy = spyOn(log, 'warn');
    const gcm = new GCM({apiKey: 'apiKey'});
    gcm.send();
    expect(spy).toHaveBeenCalled();
  });

  it('can generate GCM Payload without expiration time', (done) => {
    //Mock request data
    const requestData = {
      data: {
        'alert': 'alert'
      },
      notification: {
        'title': 'I am a title',
        'body': 'I am a body'
      }
    };
    const pushId = 'pushId';
    const timeStamp = 1454538822113;
    const timeStampISOStr = new Date(timeStamp).toISOString();

    const payload = GCM.generateGCMPayload(requestData, pushId, timeStamp);

    expect(payload.priority).toEqual('high');
    expect(payload.timeToLive).toEqual(undefined);
    const dataFromPayload = payload.data;
    expect(dataFromPayload.time).toEqual(timeStampISOStr);
    expect(payload.notification).toEqual(requestData.notification);
    expect(dataFromPayload['push_id']).toEqual(pushId);
    const dataFromUser = dataFromPayload.data;
    expect(dataFromUser).toEqual(requestData.data);
    done();
  });

  it('can generate GCM Payload with valid expiration time', (done) => {
    //Mock request data
    const requestData = {
      data: {
        'alert': 'alert'
      },
      notification: {
        'title': 'I am a title',
        'body': 'I am a body'
      }
    };
    const pushId = 'pushId';
    const timeStamp = 1454538822113;
    const timeStampISOStr = new Date(timeStamp).toISOString();
    const expirationTime = 1454538922113

    const payload = GCM.generateGCMPayload(requestData, pushId, timeStamp, expirationTime);

    expect(payload.priority).toEqual('high');
    expect(payload.timeToLive).toEqual(Math.floor((expirationTime - timeStamp) / 1000));
    const dataFromPayload = payload.data;
    expect(dataFromPayload.time).toEqual(timeStampISOStr);
    expect(payload.notification).toEqual(requestData.notification);
    expect(dataFromPayload['push_id']).toEqual(pushId);
    const dataFromUser = dataFromPayload.data;
    expect(dataFromUser).toEqual(requestData.data);
    done();
  });

  it('can generate GCM Payload with too early expiration time', (done) => {
    //Mock request data
    const requestData = {
      data: {
        'alert': 'alert'
      },
      notification: {
        'title': 'I am a title',
        'body': 'I am a body'
      }
    };
    const pushId = 'pushId';
    const timeStamp = 1454538822113;
    const timeStampISOStr = new Date(timeStamp).toISOString();
    const expirationTime = 1454538822112;

    const payload = GCM.generateGCMPayload(requestData, pushId, timeStamp, expirationTime);

    expect(payload.priority).toEqual('high');
    expect(payload.timeToLive).toEqual(0);
    const dataFromPayload = payload.data;
    expect(dataFromPayload.time).toEqual(timeStampISOStr);
    expect(payload.notification).toEqual(requestData.notification);
    expect(dataFromPayload['push_id']).toEqual(pushId);
    const dataFromUser = dataFromPayload.data;
    expect(dataFromUser).toEqual(requestData.data);
    done();
  });

  it('can generate GCM Payload with too late expiration time', (done) => {
    //Mock request data
    const requestData = {
      data: {
        'alert': 'alert'
      },
      notification: {
        'title': 'I am a title',
        'body': 'I am a body'
      }
    };
    const pushId = 'pushId';
    const timeStamp = 1454538822113;
    const timeStampISOStr = new Date(timeStamp).toISOString();
    const expirationTime = 2454538822113;

    const payload = GCM.generateGCMPayload(requestData, pushId, timeStamp, expirationTime);

    expect(payload.priority).toEqual('high');
    // Four week in second
    expect(payload.timeToLive).toEqual(4 * 7 * 24 * 60 * 60);
    const dataFromPayload = payload.data;
    expect(dataFromPayload.time).toEqual(timeStampISOStr);
    expect(payload.notification).toEqual(requestData.notification);
    expect(dataFromPayload['push_id']).toEqual(pushId);
    const dataFromUser = dataFromPayload.data;
    expect(dataFromUser).toEqual(requestData.data);
    done();
  });

  it('can send GCM request', (done) => {
    const gcm = new GCM({
      apiKey: 'apiKey'
    });
    // Mock gcm sender
    const sender = {
      send: jasmine.createSpy('send')
    };
    gcm.sender = sender;
    // Mock data
    const expirationTime = 2454538822113;
    const data = {
      'expiration_time': expirationTime,
      'data': {
        'alert': 'alert'
      }
    }
    // Mock devices
    const devices = [
      {
        deviceToken: 'token'
      }
    ];

    gcm.send(data, devices);
    expect(sender.send).toHaveBeenCalled();
    const args = sender.send.calls.first().args;
    // It is too hard to verify message of gcm library, we just verify tokens and retry times
    expect(args[1].registrationTokens).toEqual(['token']);
    expect(args[2]).toEqual(5);
    done();
  });

  it('can send GCM request', (done) => {
    const gcm = new GCM({
      apiKey: 'apiKey'
    });
    // Mock data
    const expirationTime = 2454538822113;
    const data = {
      'expiration_time': expirationTime,
      'data': {
        'alert': 'alert'
      }
    }
    // Mock devices
    const devices = [
      {
        deviceToken: 'token'
      },
      {
        deviceToken: 'token2'
      },
      {
        deviceToken: 'token3'
      },
      {
        deviceToken: 'token4'
      }
    ];
    mockSender(gcm);
    gcm.send(data, devices).then((response) => {
      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toEqual(devices.length);
      expect(response.length).toEqual(4);
      response.forEach((res, index) => {
        expect(res.transmitted).toEqual(true);
        expect(res.device).toEqual(devices[index]);
      })
      done();
    })
  });

  it('can send GCM request with slices', (done) => {
    spyOn(log, 'error').and.callFake(() => {});
    const originalMax = GCM.GCMRegistrationTokensMax;
    GCM.GCMRegistrationTokensMax = 2;
    const gcm = new GCM({
      apiKey: 'apiKey'
    });
    // Mock data
    const expirationTime = 2454538822113;
    const data = {
      'expiration_time': expirationTime,
      'data': {
        'alert': 'alert'
      }
    }
    // Mock devices
    const devices = [
      {
        deviceToken: 'token'
      },
      {
        deviceToken: 'token2'
      },
      {
        deviceToken: 'token3'
      },
      {
        deviceToken: 'token4'
      },
      {
        deviceToken: 'token5'
      },
      {
        deviceToken: 'token6'
      },
      {
        deviceToken: 'token7'
      },
      {
        deviceToken: 'token8'
      }
    ];
    spyOn(gcm, 'send').and.callThrough();
    gcm.send(data, devices).then((response) => {
      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toEqual(devices.length);
      expect(response.length).toEqual(8);
      response.forEach((res, index) => {
        expect(res.transmitted).toEqual(false);
        expect(res.device).toEqual(devices[index]);
      });
      // 1 original call
      // 4 calls (1 per slice of 2)
      expect(gcm.send.calls.count()).toBe(1 + 4);
      GCM.GCMRegistrationTokensMax = originalMax;
      done();
    })
  });

  it('can slice devices', (done) => {
    // Mock devices
    const devices = [makeDevice(1), makeDevice(2), makeDevice(3), makeDevice(4)];

    const chunkDevices = GCM.sliceDevices(devices, 3);
    expect(chunkDevices).toEqual([
      [makeDevice(1), makeDevice(2), makeDevice(3)],
      [makeDevice(4)]
    ]);
    done();
  });

  function makeDevice(deviceToken) {
    return {
      deviceToken: deviceToken
    };
  }
});

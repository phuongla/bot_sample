/**
 * Created by phuongla on 8/29/2017.
 */

const fs = require('fs');

const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');


const app = express();
const myToken = '9dDhCpntfJp5eB9UaBYNz4W9EzLWjbMJAwarZj2qN5PVJQL9fnvFsdj4DruXeJLA';

const pageToken = 'EAAXZBZCvYjdzcBAFeSFKqfdZBZCQRkudBZBHiKAWDyrAldmmWWWpFZA6OFe6X22NKCF48IlmldUeeseFpZCXTxYkZC1O92MdefGm3C48VdCsd8fGzSZAaYPQKUycm0l40ZBJG1Wvdavel5z8k9fxFZAInhGR0tcrMmQHOPhYZBztT3GlkQZDZD';


const NODE_ENV = process.env.NODE_ENV || 'development';
const port = 8887;

console.log(`Environment: ${NODE_ENV}`);


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


if(NODE_ENV === 'production') {
    const sslOptions = {
        key: fs.readFileSync('/build/key/mobo.vn.key'),
        cert: fs.readFileSync('/build/key/mobo.vn.crt'),
    };
    https.createServer(sslOptions, app).listen(port, () => {
        console.log(`App (https) listen on port: ${port}`);
    });
} else {
    app.listen(port, () => {
        console.log(`App (http) listen on port: ${port}`);
    });
}


app.get('/webhook', (req, res) => {

    if(req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === myToken) {
        console.log('Validating webhook');
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.log('Failed validating');
        res.sendStatus(403);
    }

});

app.post('/webhook', (req, res) => {
    //console.log(req.body);
    const data = req.body;
    const { object } = data;

    if(object === 'page') {
        const { entry: entries } = data;
        entries.forEach((entry) => {
            const { id: pageId, time: timeOfEvent, messaging: messagings } = entry;
            messagings.forEach((event) => {
                if(event.message) {
                    receiveMessage(event);
                } else if(event.postback) {
                    receivePostBack(event);
                } else {
                    console.log("Webhook received unknown event: ", event);
                }
            });

        });
    }

    res.sendStatus(200);
});

function receiveMessage(event) {
    const { id: senderId } = event.sender;
    const { id: recipientId } = event.recipient;
    const { message, timestamp: timeOfMessage } = event;

    console.log("Received message for user %d and page %d at %d with message:", senderId, recipientId, timeOfMessage);
    console.log(JSON.stringify(message));

    const { mid, text, attachments } = message;
    if(text) {
        sendWelcome(senderId);
    }
}

function receivePostBack(event) {

    const { id: senderId } = event.sender;
    const { id: recipientId } = event.recipient;
    const { postback, timestamp: timeOfPostback } = event;
    let { payload } = postback;

    console.log("Received postback for user %d and page %d with payload '%s' at %d", senderId, recipientId, payload, timeOfPostback);

    payload = JSON.parse(payload);
    const { cmd } = payload;

    console.log(`Postback command: ${cmd}`);

    switch (cmd) {
        case 'support_buy_product':
            sendChoseSkinType(senderId);
            break;
        case 'skin_sensitive':
        case 'skin_dry':
        case 'skin_oil':
        case 'skin_mix':
            sendChoseCosmeticType(senderId, cmd);
            break;
        case 'cosmetic_lotion':
        case 'cosmetic_sunprevent':
        case 'cosmetic_makeup':
            const { skinType } = payload;
            sendChoseProduct(senderId, skinType, cmd);
            break;
    }
}

function sendTextMessage(recipientId, msgText) {
    const msgData = {
        recipient: { id: recipientId },
        message: { text: msgText }
    };

    callSendAPI(msgData);
}

function callSendAPI(msgData) {
    const requestData = {
        uri: 'https://graph.facebook.com/v2.8/me/messages',
        qs: { access_token: pageToken },
        method: 'POST',
        json: msgData
    };

    request(requestData, (error, response, body) => {
        if(!error && response.statusCode == 200) {
            const { recipient_id: recipientId, message_id: messageId } = body;
            console.log("Successfully sent generic message with id %s to recipient %s", messageId, recipientId);
        } else {
            console.error("Unable to send message.");
            console.error(response);
            console.error(error);
        }
    });
}

function sendWelcome(recipientId) {
    const welcomeData = {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'button',
                    text: 'Chào bạn, chúng tôi có thể giúp gì cho bạn?',
                    buttons: [
                        {
                            type: 'web_url',
                            url: 'http://jeju.com.vn',
                            title: 'Xem website'
                        },
                        {
                            type: 'postback',
                            title: 'Tư vấn mỹ phẩm',
                            payload: JSON.stringify({ cmd: 'support_buy_product' })
                        }
                    ]
                }
            }
        }
    };
    callSendAPI(welcomeData);
}

function sendChoseSkinType(recipientId) {
    const welcomeData = {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'button',
                    text: 'Da bạn thuộc loại nào?',
                    buttons: [
                        {
                            type: 'postback',
                            title: 'Da dầu',
                            payload: JSON.stringify({ cmd: 'skin_oil' })
                        },
                        {
                            type: 'postback',
                            title: 'Da khô',
                            payload: JSON.stringify({ cmd: 'skin_dry' })
                        },
                        {
                            type: 'postback',
                            title: 'Da nhạy cảm',
                            payload: JSON.stringify({ cmd: 'skin_sensitive' })
                        },
                    ]
                }
            }
        }
    };
    callSendAPI(welcomeData);
}

function sendChoseCosmeticType(recipientId, skinType) {
    const welcomeData = {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'button',
                    text: 'Bạn cần mua loại mỹ phẩm nào?',
                    buttons: [
                        {
                            type: 'postback',
                            title: 'Dưỡng da',
                            payload: JSON.stringify({ cmd: 'cosmetic_lotion', skinType })
                        },
                        {
                            type: 'postback',
                            title: 'Chống nắng',
                            payload: JSON.stringify({ cmd: 'cosmetic_sunprevent', skinType })
                        },
                        {
                            type: 'postback',
                            title: 'Trang điểm',
                            payload: JSON.stringify({ cmd: 'cosmetic_makeup', skinType })
                        },
                    ]
                }
            }
        }
    };
    callSendAPI(welcomeData);
}

function sendChoseProduct(recipientId, skinType, cosmeticType) {

    let skinWord = '';

    switch (skinType) {
        case 'skin_oil':
            skinWord = 'da-dau';
            break;
        case 'skin_dry':
            skinWord = 'da-kho';
            break;
        case 'skin_mix':
            skinWord = 'da-hon-hop';
            break;
        case 'skin_sensitive':
            skinWord = 'da-nhay-cam';
            break;
    }

    const welcomeData = {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'list',
                    top_element_style: 'compact',
                    elements: [
                        {
                            title: 'Dòng mỹ phẩm theo da',
                            subtitle: 'Vui lòng click xem chi tiết',
                            image_url: "https://cdn.hermo.my/hermo/Uploads/2014/12/images/Innisfree%20Green%20Tea.jpg",
                            buttons: [
                                {
                                    'title': 'View',
                                    'type': 'web_url',
                                    'url': `https://goo.gl/oFVox8`,
                                    'messenger_extensions': true,
                                    'webview_height_ratio': 'tall',
                                    'fallback_url': 'https://goo.gl/hKxwo6'
                                }
                            ]
                        },
                        {
                            'title': 'Bộ dưỡng da trà xanh',
                            'subtitle': 'Vui lòng click xem chi tiết',
                            'default_action': {
                                'type': 'web_url',
                                'url': 'https://goo.gl/XAkFiF',
                                'messenger_extensions': true,
                                'webview_height_ratio': 'tall',
                                'fallback_url': 'https://goo.gl/hKxwo6'
                            }
                        },
                    ]
                }
            }
        }
    };
    callSendAPI(welcomeData);
}
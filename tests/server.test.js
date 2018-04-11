const expect = require('expect');
const request = require('supertest');

const {app} = require('./../server');
const {Clip} = require('./../models/Clip');

// beforeEach((done) => {
//     Clip.remove({}).then(() => done());
// });

describe('POST /clips', () => {
    it('Should create a new clip', (done) => {
        var text = 'a';

        request(app)
            .post('/clips')
            .send({text})
            .expect(200)
            .expect((res) => {
                expect(res.body.text).toBe(text);
            })
            .end((err, res) => {
                if (err) {
                    return done(err);
                }

                Clip.find().then((clips) => {
                    expect(clips.length).toBe(1);
                    expect(clips[0].text).toBe(text);
                    done();
                }).catch((e) => {
                    done(e);
                });
            });
    });

    // it('Should not create Clip with invalid body data', (done) => {

    // });
});
'use strict';
const bookshelf = require('../../test/fixtures/DB-fixture').bookshelf;
const knex = require('../../test/fixtures/DB-fixture').knex;
const User = require('./userModel');
const tokenController = require('../Utils/tokenController');
const bcrypt = require('bcrypt');

const SALT_FACTOR = 10;
const userController = {};

userController.createTable = () => {
  return knex.schema.createTableIfNotExists('users', user => {
    user.increments();
    user.string('name');
    user.string('emailID');
    user.string('email');
    user.string('password');
  });
};

userController.authenticateUser = (req, res, next) => {
  User
    .query({where: {email: req.body.email}})
    .fetch()
    .then( model => {
      if (!model) {
        return res.status(400).send('Invalid email');
      }

      const isValidUser = userController.decryptPassword(req.body, model.attributes.password, res);
      
      return isValidUser ? next() : res.status(401).send('Password does not match our records.');
    })
    .catch( err => {
      return res.status(400).send('Error authenticating user.');
    });
};

userController.createUser = (req, res, next) => {
  if (!req.body.name || !req.body.email || !req.body.password) {
    return res.status(401).send('Missing name, email, or password!');
  }

  userController.createTable()
    .then( () => {
      User
        .query({where: {email: req.body.email}})
        .fetch()
        .then( model => {
          if (model) {
            return res.status(400).send('Username is already taken.');
          }

          userController.createEmailID(req.body);
          userController.encryptPassword(req.body);

          User.forge(req.body).save().then( result => {
            return res.status(201).send({
              id_token: tokenController.createToken(result.attributes, req.body.email)
            });
          });
        });
    })
    .catch( err => {
      return res.status(400).send('Error adding user to database');
    });
};

userController.createEmailID = user => {
  let ID = (Math.random().toString(36) + '00000000000000000').slice(2, 5 + 2);
  let indexOfAt = user.email.indexOf('@');

  user.emailID = user.email.slice(0, indexOfAt) + ID;
};

userController.encryptPassword = user => {
  const salt = bcrypt.genSaltSync(SALT_FACTOR);
  const hash = bcrypt.hashSync(user.password, salt);
  user.password = hash;
};

userController.decryptPassword = (user, password, res) => {
  return bcrypt.compareSync(user.password, password);
};

module.exports = userController;

const mongoose = require("mongoose");
const User = require("./User");
const { promisify } = require("es6-promisify");
const passport = require("passport");

exports.register = async (req, res, next) => {
  const user = new User({ username: req.body.username });
  console.log(user);
  const register = promisify(User.register).bind(User);
  console.log(user);
  try {
    await register(user, req.body.password);
    next();
  } catch (e) {
    res.redirect("/");
  }

  //pass to auth controller
};

exports.login = passport.authenticate("local");
// , {
//   failureRedirect: "/",
//   //   failureFlash: "Failed login",
//   //   successFlash: "Welcome!",
//   successRedirect: "/home"
// });

exports.logout = (req, res) => {
  req.logout();
  // req.flash('success','You successfully logged out!');
  res.redirect("/");
};

exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  // req.flash('error','Please Login in order to do that');
  res.redirect("/");
};

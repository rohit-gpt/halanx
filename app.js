var express = require("express");
var app = express();
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var passport = require("passport");
var LocalStrategy = require("passport-local");
var passportLocalMongoose = require("passport-local-mongoose");
var flash = require("connect-flash");
var methodOverride = require("method-override");

var plotly = require('plotly')(process.env.USERNAME, process.env.KEY);

// mongoose.connect("mongodb://localhost/halanx");
mongoose.connect(process.env.DATABASEURL);

var placeSchema = new mongoose.Schema({
	image: String,
	size: String,
	rent: Number,
	security: Number,
	type: String,
	locality: String,
	area: Number,
	beds: Number,
	openingTime: String,
	datesOfVisit: []
});

var Place = mongoose.model("Place", placeSchema);

var userSchema = new mongoose.Schema({
	name: String,
	username: String,
	password: String,
	places: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Place"
		}
	]
});

userSchema.plugin(passportLocalMongoose);

var User = mongoose.model("User", userSchema);

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.use(flash());
app.use(require("express-session")({
    secret: "Let's work",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(express.static(__dirname + "/public"));

app.use(function(req, res, next) {
	res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});








// ====================================AUTH ROUTES======================================================








app.get("/login", function(req, res) {
	res.render("login");
});

app.get("/register", function(req, res) {
	res.render("register");
});

app.post("/register", function(req, res) {
    User.register(new User({username: req.body.username, name: req.body.name}), req.body.password, function(err, user){
        if(err) {
            req.flash("error", err.message);
            res.redirect("/register");
        }
        passport.authenticate("local")(req, res, function() {
            req.flash("success", "Account created successfully");
            res.redirect("/users/" + user._id);
        });
    });
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/users",
    failureRedirect: "/login"
}), function(req, res) {
});

app.get("/users", function(req, res) {
	res.redirect("/users/" + req.user._id);
});

app.get("/logout", function(req, res) {
	req.logout();
	req.flash("success", "Logged you out!");
	res.redirect("/");
});








app.get("/", function(req, res) {
	Place.find({}, function(err, places) {
		if(err) {
			console.log(err);
			req.flash("error", err.message);
			res.redirect("/login");
		} else {
			console.log(places);
			res.render("landing", {places: places});
		}
	});
});

app.post("/places/:id/schedule", function(req, res) {
	Place.findById(req.params.id, function(err, place) {
		if(err) {
			console.log(err);
			req.flash("error", err.message);
		}
		place.datesOfVisit.push(req.body.date);
		place.save();
		req.flash("success", "Visit Booked!");
		res.redirect("/");
	});
});












app.get("/users/:id",isLoggedIn, function(req, res) {
	User.findById(req.params.id).populate("places").exec(function(err, user ) {
		if(err) {
			res.redirect("/login");
		}
		res.render("dashboard", {user: user});
	});
});

app.get("/users/:id/newplace", isLoggedIn, function(req, res) {
	User.findById(req.params.id, function(err, user) {
		if(err) {
			console.log(err);
		} else {
			res.render("newplace", {user: user});
		}
	});
});

app.post("/users/:id/place", isLoggedIn, function(req, res) {
	User.findById(req.params.id, function(err, user) {
		if(err) {
			console.log(err);
		} else {
			Place.create({
				image: req.body.image,
				size: req.body.size,
				rent: req.body.rent,
				security: req.body.security,
				type: req.body.type,
				locality: req.body.locality,
				area: req.body.area,
				beds: req.body.beds,
				openingTime: req.body.openingTime
			}, function(err, place) {
				if(err) {
					console.log(err);
					req.flash("error", err.message);
					res.redirect("/users/" + req.params.id);
				}
				user.places.push(place);
				user.save();
				req.flash("success", "Place created Sussessfully!");
				res.redirect("/users/" + req.params.id);
			});
		}
	});
});

app.get("/users/:id/places/:placeId/plot", function(req, res) {
	User.findById(req.params.id, function(err, user) {
		if(err) {
			console.log(err);
		} else {
			Place.findById(req.params.placeId, function(err, place) {
				if(err) {
					console.log(err);
				} else {

					var a = [], b = [], prev;

				    place.datesOfVisit.sort();

				    for ( var i = 0; i < place.datesOfVisit.length; i++ ) {
				        if ( place.datesOfVisit[i] !== prev ) {
				            a.push(place.datesOfVisit[i]);
				            b.push(1);
				        } else {
				            b[b.length-1]++;
				        }
				        prev = place.datesOfVisit[i];
				    }

					var data = [
					{
						x: a,
						y: b,
						type: "scatter"
					}
					];
					var graphOptions = {filename: "date-axes", fileopt: "overwrite"};
					plotly.plot(data, graphOptions, function (err, msg) {
						res.redirect(msg.url);
					});
				}
			});
		}
	});
});

app.get("/users/:id/places/:placeId/edit", function(req, res) {
	User.findById(req.params.id, function(err, user) {
		if(err) {
			console.log(err);
		} else {
			Place.findById(req.params.placeId, function(err,place) {
				if(err) {
					console.log(err);
				} else {
					res.render("placeUpdate", {user: user, place: place});
				}
			});
		}
	});
});

app.put("/users/:id/places/:placeId/", function(req, res) {
	User.findById(req.params.id, function(err, user) {
		if(err) {
			console.log(err);
		} else {
			Place.findByIdAndUpdate(req.params.placeId, req.body.update, function(err, updated) {
				if(err) {
					console.log(err);
				} else {
					req.flash("success", "Update Successfull");
					res.redirect("/");
				}
			});
		}
	});
});

function isLoggedIn(req, res, next) {
	if(req.isAuthenticated()) {
		return next();
	}
	req.flash("error", "Please Login First");
	res.redirect("/login");
}

app.listen(process.env.PORT, process.env.IP, function() {
	console.log("Server Started");
});

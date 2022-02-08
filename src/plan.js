(function() {
	'use strict';

	var L = require('leaflet');
	var GeocoderElement = require('./geocoder-element');
	var Waypoint = require('./waypoint');

	module.exports = (L.Layer || L.Class).extend({
		includes: ((typeof L.Evented !== 'undefined' && L.Evented.prototype) || L.Mixin.Events),

		options: {
			dragStyles: [
				{color: 'black', opacity: 0.15, weight: 9},
				{color: 'white', opacity: 0.8, weight: 6},
				{color: 'red', opacity: 1, weight: 2, dashArray: '7,12'}
			],
			draggableWaypoints: true,
			routeWhileDragging: false,
			addWaypoints: true,
			reverseWaypoints: false,
			addButtonClassName: '',
			language: 'en',
			createGeocoderElement: function(wp, i, nWps, plan) {
				return new GeocoderElement(wp, i, nWps, plan);
			},
			createMarker: function(i, wp) {
				var options = {
						draggable: this.draggableWaypoints
					},
				    marker = L.marker(wp.latLng, options);

				return marker;
			},
			geocodersClassName: ''
		},

		initialize: function(waypoints, options) {
			L.Util.setOptions(this, options);
			this._waypoints = [];
			this.setWaypoints(waypoints);
		},

		isReady: function() {
			var i;
			for (i = 0; i < this._waypoints.length; i++) {
				if (!this._waypoints[i].latLng) {
					return false;
				}
			}

			return true;
		},

		getEVParams: function() {
			
			// ev extra params
			var evparams = {
				departure_battery_pct: this._departureBatterySlider.value,
				preferred_start_charge_battery_pct: this._preferredBeginChargeBatterySlider.value,
				preferred_stop_charge_battery_pct: this._preferredEndChargeBatterySlider.value,
				preferred_arrival_battery_pct: this._preferredArrivalBatterySlider.value,
				ev_model: this._evModelsSelect.value,

				// simple uuid for req
				req_id: Date.now() +"-"+ (Math.random()*1000).toFixed(0),
			};

			return evparams;
		},

		setEVTripMetadata: function(metadata) {
			this._metadata = metadata;
			return this;
		},

		setEVTripScoringServiceUrl: function(url) {
			if (this._evtrip_scroing_service_url === undefined) {
				var urls = url.split('//');

				this._evtrip_scroing_service_url = urls[0]+'//'+(urls[1].split('/'))[0];
				console.debug("_evtrip_scroing_service_url: " + this._evtrip_scroing_service_url);
			}
			return this;
		},

		getWaypoints: function() {
			var i,
				wps = [];

			for (i = 0; i < this._waypoints.length; i++) {
				wps.push(this._waypoints[i]);
			}

			return wps;
		},

		setWaypoints: function(waypoints) {
			var args = [0, this._waypoints.length].concat(waypoints);
			this.spliceWaypoints.apply(this, args);
			return this;
		},

		spliceWaypoints: function() {
			var args = [arguments[0], arguments[1]],
			    i;

			for (i = 2; i < arguments.length; i++) {
				args.push(arguments[i] && arguments[i].hasOwnProperty('latLng') ? arguments[i] : new Waypoint(arguments[i]));
			}

			[].splice.apply(this._waypoints, args);

			// Make sure there's always at least two waypoints
			while (this._waypoints.length < 2) {
				this.spliceWaypoints(this._waypoints.length, 0, null);
			}

			this._updateMarkers();
			this._fireChanged.apply(this, args);
		},

		onAdd: function(map) {
			this._map = map;
			this._updateMarkers();
		},

		onRemove: function() {
			var i;
			this._removeMarkers();

			if (this._newWp) {
				for (i = 0; i < this._newWp.lines.length; i++) {
					this._map.removeLayer(this._newWp.lines[i]);
				}
			}

			delete this._map;
		},

		createGeocoders: function() {
			var container = L.DomUtil.create('div', 'leaflet-routing-geocoders ' + this.options.geocodersClassName),
				waypoints = this._waypoints,
			    addWpBtn,
			    reverseBtn;

			this._geocoderContainer = container;
			this._geocoderElems = [];


			// disable add waypoints button
			// if (this.options.addWaypoints) {
			// 	addWpBtn = L.DomUtil.create('button', 'leaflet-routing-add-waypoint ' + this.options.addButtonClassName, container);
			// 	addWpBtn.setAttribute('type', 'button');
			// 	L.DomEvent.addListener(addWpBtn, 'click', function() {
			// 		this.spliceWaypoints(waypoints.length, 0, null);
			// 	}, this);
			// }

			if (this.options.reverseWaypoints) {
				reverseBtn = L.DomUtil.create('button', 'leaflet-routing-reverse-waypoints', container);
				reverseBtn.setAttribute('type', 'button');
				L.DomEvent.addListener(reverseBtn, 'click', function() {
					this._waypoints.reverse();
					this.setWaypoints(this._waypoints);
				}, this);

			}			

			var labelColor = 'MidnightBlue';
			var labelFontWeight = 'bold';

			var placeholderLabel = L.DomUtil.create('p', '', container);	// improve display 
			//placeholderLabel.innerText = "EVTrip";
			placeholderLabel.style.color = labelColor;
			placeholderLabel.style.fontWeight = labelFontWeight;
			//placeholderLabel.style.borderBottom = 'solid';
		
			var departureBatteryLabel = L.DomUtil.create('label', '', container);
			departureBatteryLabel.innerText = "Departure Battery  " + 100 + "%";
			departureBatteryLabel.style.color = labelColor;
			departureBatteryLabel.style.fontWeight = labelFontWeight;
			var departureBatterySlider = L.DomUtil.create('input', 'departure-battery-slider', container);
			departureBatterySlider.type = 'range';
			departureBatterySlider.setAttribute('orient', 'horizontal');
			departureBatterySlider.min = 1;
			departureBatterySlider.max = 100;
			departureBatterySlider.step = 1;
			departureBatterySlider.value = 100;
			L.DomEvent.on(departureBatterySlider, 'change', function(e) {
				console.debug('departureBatterySlider value: '+e.target.value);
				departureBatteryLabel.innerText = "Departure Battery  " + e.target.value + "%";
				//this.fire('change', {value: e.target.value});
				this.setWaypoints(this._waypoints);	//trigger route request via waypoints
			}.bind(this));

			var beginChargeMin = 15, beginChargeMax = 70, beginChargeDefault = 15;
			var endChargeMin = 50, endChargeMax = 100, endChargeDefault = 80;
			var beginChargeTextPrefix = "Preferred START Charge Battery  ";
			var endChargeTextPrefix = "Preferred STOP Charge Battery  ";

			var preferredBeginChargeBatteryLabel = L.DomUtil.create('label', '', container);
			preferredBeginChargeBatteryLabel.innerHTML = beginChargeTextPrefix + beginChargeDefault + "%";
			preferredBeginChargeBatteryLabel.style.color = labelColor;
			preferredBeginChargeBatteryLabel.style.fontWeight = labelFontWeight;
			var preferredBeginChargeBatterySlider = L.DomUtil.create('input', 'preferred-begin-charge-battery-slider', container);
			preferredBeginChargeBatterySlider.type = 'range';
			preferredBeginChargeBatterySlider.setAttribute('orient', 'horizontal');
			preferredBeginChargeBatterySlider.min = beginChargeMin;
			preferredBeginChargeBatterySlider.max = beginChargeMax;
			preferredBeginChargeBatterySlider.step = 1;
			preferredBeginChargeBatterySlider.value = beginChargeDefault;
			L.DomEvent.on(preferredBeginChargeBatterySlider, 'change', function(e) {
				console.debug('preferred-begin-charge-battery-slider value: '+e.target.value);
				preferredBeginChargeBatteryLabel.innerText = beginChargeTextPrefix + e.target.value + "%";
				if (e.target.value >= preferredEndChargeBatterySlider.value) {
					var endChargeTargetValue = endChargeDefault;
					console.debug('preferred-end-charge-battery-slider value ajust to: '+endChargeTargetValue);
					preferredEndChargeBatterySlider.value = endChargeTargetValue;
					preferredEndChargeBatteryLabel.innerText = endChargeTextPrefix + endChargeTargetValue + "%";
				}
				
				this.setWaypoints(this._waypoints);	//trigger route request via waypoints
			}.bind(this));

			var preferredEndChargeBatteryLabel = L.DomUtil.create('label', '', container);
			preferredEndChargeBatteryLabel.innerHTML = endChargeTextPrefix + endChargeDefault + "%";
			preferredEndChargeBatteryLabel.style.color = labelColor;
			preferredEndChargeBatteryLabel.style.fontWeight = labelFontWeight;
			var preferredEndChargeBatterySlider = L.DomUtil.create('input', 'preferred-end-charge-battery-slider', container);
			preferredEndChargeBatterySlider.type = 'range';
			preferredEndChargeBatterySlider.setAttribute('orient', 'horizontal');
			preferredEndChargeBatterySlider.min = endChargeMin;
			preferredEndChargeBatterySlider.max = endChargeMax;
			preferredEndChargeBatterySlider.step = 1;
			preferredEndChargeBatterySlider.value = endChargeDefault;
			L.DomEvent.on(preferredEndChargeBatterySlider, 'change', function(e) {
				console.debug('preferred-end-charge-battery-slider value: '+e.target.value);
				preferredEndChargeBatteryLabel.innerText = endChargeTextPrefix + e.target.value + "%";
				if (e.target.value <= preferredBeginChargeBatterySlider.value) {
					var beginChargeTargetValue = beginChargeDefault;
					console.debug('preferred-begin-charge-battery-slider value ajust to: '+beginChargeTargetValue);
					preferredBeginChargeBatterySlider.value = beginChargeTargetValue;
					preferredBeginChargeBatteryLabel.innerText = beginChargeTextPrefix + beginChargeTargetValue + "%";
				}

				this.setWaypoints(this._waypoints);	//trigger route request via waypoints
			}.bind(this));

			var arrivalMin = 15, arrivalMax = 70, arrvialDefault = 15;
			var preferredArrivalBatteryLabel = L.DomUtil.create('label', '', container);
			preferredArrivalBatteryLabel.innerHTML = "Preferred Arrival Battery  " + arrvialDefault + "%";
			preferredArrivalBatteryLabel.style.color = labelColor;
			preferredArrivalBatteryLabel.style.fontWeight = labelFontWeight;
			var preferredArrivalBatterySlider = L.DomUtil.create('input', 'preferred-arrvial-battery-slider', container);
			preferredArrivalBatterySlider.type = 'range';
			preferredArrivalBatterySlider.setAttribute('orient', 'horizontal');
			preferredArrivalBatterySlider.min = arrivalMin;
			preferredArrivalBatterySlider.max = arrivalMax;
			preferredArrivalBatterySlider.step = 1;
			preferredArrivalBatterySlider.value = arrvialDefault;
			L.DomEvent.on(preferredArrivalBatterySlider, 'change', function(e) {
				console.debug('preferred-arrvial-battery-slider value: '+e.target.value);
				preferredArrivalBatteryLabel.innerText = "Preferred Arrival Battery  " + e.target.value + "%";
				//this.fire('change', {value: e.target.value});
				this.setWaypoints(this._waypoints);	//trigger route request via waypoints
			}.bind(this));

			var likeThisTripButton = L.DomUtil.create('button', 'leaflet-routing-good-trip', container);
			likeThisTripButton.setAttribute('type', 'button');
			likeThisTripButton.setAttribute('title', 'Good Trip!');
			L.DomEvent.addListener(likeThisTripButton, 'click', function() {
				var score_req = this._evtrip_scroing_service_url+"/ev/route/score?trip_id="+this._metadata.req_id+"&score=1";
				var xhttp = new XMLHttpRequest();
				xhttp.open("POST", score_req, true);
				xhttp.send();
				console.debug(score_req);
				alert("Trip ID "+this._metadata.req_id+" looks GOOD!\nThanks for the feedback!")
			}, this);

			var dislikeThisTripButton = L.DomUtil.create('button', 'leaflet-routing-bad-trip', container);
			dislikeThisTripButton.type = 'button';
			dislikeThisTripButton.setAttribute("title", "Bad Trip!");
			L.DomEvent.addListener(dislikeThisTripButton, 'click', function() {
				var score_req = this._evtrip_scroing_service_url+"/ev/route/score?trip_id="+this._metadata.req_id+"&score=0";
				var xhttp = new XMLHttpRequest();
				xhttp.open("POST", score_req, true);
				xhttp.send();
				console.debug(score_req);
				alert("Trip ID "+this._metadata.req_id+" looks BAD!\nThanks for the feedback!")
			}, this);

			var showMetadataButton = L.DomUtil.create('button', 'leaflet-routing-show-metadata', container);
			showMetadataButton.type = 'button';
			showMetadataButton.setAttribute("title", "Show Trip Metadata");
			L.DomEvent.addListener(showMetadataButton, 'click', function() {
				if (this._metadata){
					prompt("please press Ctrl+C to copy the text below:", JSON.stringify(this._metadata));
				}
			}, this);

			var supportedEVModels = {
				'tesla_model3': 'Tesla Model 3', 
				'tesla_models2': 'Tesla Model S2',
				'ford_mach-e': 'Ford Match E'
			}
			var evModelsSelect = L.DomUtil.create('select', '', container);
			evModelsSelect.setAttribute('title', 'Select EV Model');
			L.DomEvent.on(evModelsSelect, 'change', function(e) {
				console.debug('on evModelsSelect');
				this.setWaypoints(this._waypoints);	//trigger route request via waypoints
			}.bind(this));
			Object.keys(supportedEVModels).forEach(function(key) {
				var option = L.DomUtil.create('option', '', evModelsSelect);
				option.setAttribute('value', key);
				option.appendChild(
					document.createTextNode(supportedEVModels[key])
				);
				// if (key == _this._local.key)
				// {
				// 	option.setAttribute('selected', '');
				// }
			});

			this._departureBatterySlider = departureBatterySlider;
			this._preferredBeginChargeBatterySlider = preferredBeginChargeBatterySlider;
			this._preferredEndChargeBatterySlider = preferredEndChargeBatterySlider;
			this._preferredArrivalBatterySlider = preferredArrivalBatterySlider;

			this._evModelsSelect = evModelsSelect;

			//TODO: temporarily disabled 
			this._preferredBeginChargeBatterySlider.disabled = false;
			this._preferredEndChargeBatterySlider.disabled = false;
			this._preferredArrivalBatterySlider.disabled = false;

			this._updateGeocoders();
			this.on('waypointsspliced', this._updateGeocoders);

			return container;
		},

		_createGeocoder: function(i) {
			var geocoder = this.options.createGeocoderElement(this._waypoints[i], i, this._waypoints.length, this.options);
			geocoder
			.on('delete', function() {
				if (i > 0 || this._waypoints.length > 2) {
					this.spliceWaypoints(i, 1);
				} else {
					this.spliceWaypoints(i, 1, new Waypoint());
				}
			}, this)
			.on('geocoded', function(e) {
				this._updateMarkers();
				this._fireChanged();
				this._focusGeocoder(i + 1);
				this.fire('waypointgeocoded', {
					waypointIndex: i,
					waypoint: e.waypoint
				});
			}, this)
			.on('reversegeocoded', function(e) {
				this.fire('waypointgeocoded', {
					waypointIndex: i,
					waypoint: e.waypoint
				});
			}, this);

			return geocoder;
		},

		_updateGeocoders: function() {
			var elems = [],
				i,
			    geocoderElem;

			for (i = 0; i < this._geocoderElems.length; i++) {
				this._geocoderContainer.removeChild(this._geocoderElems[i].getContainer());
			}

			for (i = this._waypoints.length - 1; i >= 0; i--) {
				geocoderElem = this._createGeocoder(i);
				this._geocoderContainer.insertBefore(geocoderElem.getContainer(), this._geocoderContainer.firstChild);
				elems.push(geocoderElem);
			}

			this._geocoderElems = elems.reverse();
		},

		_removeMarkers: function() {
			var i;
			if (this._markers) {
				for (i = 0; i < this._markers.length; i++) {
					if (this._markers[i]) {
						this._map.removeLayer(this._markers[i]);
					}
				}
			}
			this._markers = [];
		},

		_updateMarkers: function() {
			var i,
			    m;

			if (!this._map) {
				return;
			}

			this._removeMarkers();

			for (i = 0; i < this._waypoints.length; i++) {
				if (this._waypoints[i].latLng) {
					m = this.options.createMarker(i, this._waypoints[i], this._waypoints.length);
					if (m) {
						m.addTo(this._map);
						if (this.options.draggableWaypoints) {
							this._hookWaypointEvents(m, i);
						}
					}
				} else {
					m = null;
				}
				this._markers.push(m);
			}
		},

		_fireChanged: function() {
			this.fire('waypointschanged', {waypoints: this.getWaypoints()});

			if (arguments.length >= 2) {
				this.fire('waypointsspliced', {
					index: Array.prototype.shift.call(arguments),
					nRemoved: Array.prototype.shift.call(arguments),
					added: arguments
				});
			}
		},

		_hookWaypointEvents: function(m, i, trackMouseMove) {
			var eventLatLng = function(e) {
					return trackMouseMove ? e.latlng : e.target.getLatLng();
				},
				dragStart = L.bind(function(e) {
					this.fire('waypointdragstart', {index: i, latlng: eventLatLng(e)});
				}, this),
				drag = L.bind(function(e) {
					this._waypoints[i].latLng = eventLatLng(e);
					this.fire('waypointdrag', {index: i, latlng: eventLatLng(e)});
				}, this),
				dragEnd = L.bind(function(e) {
					this._waypoints[i].latLng = eventLatLng(e);
					this._waypoints[i].name = '';
					if (this._geocoderElems) {
						this._geocoderElems[i].update(true);
					}
					this.fire('waypointdragend', {index: i, latlng: eventLatLng(e)});
					this._fireChanged();
				}, this),
				mouseMove,
				mouseUp;

			if (trackMouseMove) {
				mouseMove = L.bind(function(e) {
					this._markers[i].setLatLng(e.latlng);
					drag(e);
				}, this);
				mouseUp = L.bind(function(e) {
					this._map.dragging.enable();
					this._map.off('mouseup', mouseUp);
					this._map.off('mousemove', mouseMove);
					dragEnd(e);
				}, this);
				this._map.dragging.disable();
				this._map.on('mousemove', mouseMove);
				this._map.on('mouseup', mouseUp);
				dragStart({latlng: this._waypoints[i].latLng});
			} else {
				m.on('dragstart', dragStart);
				m.on('drag', drag);
				m.on('dragend', dragEnd);
			}
		},

		dragNewWaypoint: function(e) {
			var newWpIndex = e.afterIndex + 1;
			if (this.options.routeWhileDragging) {
				this.spliceWaypoints(newWpIndex, 0, e.latlng);
				this._hookWaypointEvents(this._markers[newWpIndex], newWpIndex, true);
			} else {
				this._dragNewWaypoint(newWpIndex, e.latlng);
			}
		},

		_dragNewWaypoint: function(newWpIndex, initialLatLng) {
			var wp = new Waypoint(initialLatLng),
				prevWp = this._waypoints[newWpIndex - 1],
				nextWp = this._waypoints[newWpIndex],
				marker = this.options.createMarker(newWpIndex, wp, this._waypoints.length + 1),
				lines = [],
				draggingEnabled = this._map.dragging.enabled(),
				mouseMove = L.bind(function(e) {
					var i,
						latLngs;
					if (marker) {
						marker.setLatLng(e.latlng);
					}
					for (i = 0; i < lines.length; i++) {
						latLngs = lines[i].getLatLngs();
						latLngs.splice(1, 1, e.latlng);
						lines[i].setLatLngs(latLngs);
					}

					L.DomEvent.stop(e);
				}, this),
				mouseUp = L.bind(function(e) {
					var i;
					if (marker) {
						this._map.removeLayer(marker);
					}
					for (i = 0; i < lines.length; i++) {
						this._map.removeLayer(lines[i]);
					}
					this._map.off('mousemove', mouseMove);
					this._map.off('mouseup', mouseUp);
					this.spliceWaypoints(newWpIndex, 0, e.latlng);
					if (draggingEnabled) {
						this._map.dragging.enable();
					}

					L.DomEvent.stop(e);
				}, this),
				i;

			if (marker) {
				marker.addTo(this._map);
			}

			for (i = 0; i < this.options.dragStyles.length; i++) {
				lines.push(L.polyline([prevWp.latLng, initialLatLng, nextWp.latLng],
					this.options.dragStyles[i]).addTo(this._map));
			}

			if (draggingEnabled) {
				this._map.dragging.disable();
			}

			this._map.on('mousemove', mouseMove);
			this._map.on('mouseup', mouseUp);
		},

		_focusGeocoder: function(i) {
			if (this._geocoderElems[i]) {
				this._geocoderElems[i].focus();
			} else {
				document.activeElement.blur();
			}
		}
	});
})();

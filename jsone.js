(function(root) {
	'use strict';

	var jsone = function(config) {
		var self = this;

		self.__config = config || {};
		if (!Array.isArray(self.__config.editable)) {
			self.__config.editable = ['string', 'number', 'date', 'boolean'];
		}
		if (self.__config.hashNavigation) {
			window.addEventListener('hashchange', function(e) {
				var hash = (window.location.hash || '').substr(1);
				if(hash){ hash = '/'+hash; }
				var rowstate = self.__state.rows[self.__state.rowsref[self.jsonName + hash]];
				if (rowstate) {
					self.goToNode(rowstate, true, true);
				}
			})
		}

		// the node we write into. Take provided node, query selector, id=jsone or just the body
		self.__node = DOM(config.node || document.querySelector(config.node) || document.getElementById('jsone') || document.body).class('jsone');

		self.__state = {
			rows: [],
			rowsref: {},
			conf: {},
			help: 0,
			is_changed: false,
			changes: {}
		};

		self.inputChangeEvent = function(el, joinpath) {
			clearTimeout(self.__state.changes_timer);
			self.__state.changes_timer = setTimeout(function() {
				self.checkForChanges(el, joinpath);
			}, 100);
		};

		self.jsonChangeEvent = function(el, joinpath) {
			clearTimeout(self.__state.changes_timer);
			self.__state.changes_timer = setTimeout(function() {
				self.checkForChangesJSON(el, joinpath)
			}, 100);
		};
		self.checkForChangesJSON = function(el, joinpath) {
			var json_object, ok = false;
			try {
				json_object = JSON.parse(el.value);
				ok = true;
				el.style.outline = '';
			} catch (e) {
				self.emit('jsonparse', joinpath);
				el.style.outline = '2px solid red';
			}
			if (ok) {
				var index = self.__state.rowsref[joinpath];
				var rowstate = self.__state.rows[index];
				if (rowstate) {
					if (JSON.stringify(rowstate.node[rowstate.key]) !== JSON.stringify(json_object)) {

						if (typeof json_object === 'object') {
							// by reference hack i guess
							for (var k in json_object) {
								rowstate.node[rowstate.key][k] = json_object[k];
							}
							for (var k in rowstate.node[rowstate.key]) {
								if (typeof json_object[k] === 'undefined') {
									delete rowstate.node[rowstate.key][k];
								}
							}
						} else {
							rowstate.node[rowstate.key] = json_object;
						}

						// mark sub-tree changed
						var subrowstate = self.__state.rows[index];
						while (subrowstate) {
							if (subrowstate.joinpath.indexOf(joinpath) === 0) {
								subrowstate.changed = true;
								index++;
								subrowstate = self.__state.rows[index];
							} else {
								subrowstate = false;
							}
						}

						self.__track_change(joinpath, json_object);
						self.renderState({
							rowsOnly: true
						});
					}
				}
			}
		}

		self.checkForChanges = function(el, joinpath) {
			var rowstate = self.__state.rows[self.__state.rowsref[joinpath]];
			if (rowstate) {
				if (rowstate.node[rowstate.key] != el.value) {
					if (rowstate.type === 'number') {
						rowstate.node[rowstate.key] = el.value && el.value != '0' ? el.value * 1 : '';
					} else if (rowstate.type === 'boolean') {
						rowstate.node[rowstate.key] = el.checked;
					} else {
						rowstate.node[rowstate.key] = el.value || ''
					}

					rowstate.changed = true;
					self.__track_change(joinpath, rowstate.node[rowstate.key]);
					self.renderState({
						rowsOnly: true
					});
				}
			}
		};

		self.valueFromPath = function(path){
			return self.getFromPath(self.__json, path);
		}

		self.getFromPath = function(obj, path) {
			var cur = obj,
				fail = false;
			path.forEach(function(k) {
				if (typeof cur[k] !== 'undefined') {
					cur = cur[k];
				} else {
					fail = true;
				}
			});
			return fail ? false : cur;
		};

		// accept a javascript object or a URL to one
		self.json = function(json) {
			if (!json) {
				self.initJSON();
				return false;
			}
			var typeofjson = typeof json;

			if (typeofjson === 'object') {
				self.__json = json;
				if (!self.__jsonSaveKey) {
					self.__jsonSaveKey = self.__config.jsonName || 'customObject';
				}
				self.initJSON();
			} else if (typeofjson === 'string') {
				self.__jsonSaveKey = json;
				self.fetch(json, function(err, json) {
					if (!json) {
						self.emit('error', 'request error ' + err);
					}
					self.json(json);
				});
			}
		};

		self.getNodeType = function(node) {
			var type = Array.isArray(node) ? 'array' : typeof node;
			if (type === 'object' && node === null) {
				type = 'null';
			}
			return type;
		};

		// exec func on every part of the object, continue looping if the item is an object or array
		self.loopJSON = function(node, key, path, func) {
			if (path.length) {
				var type = self.getNodeType(node[key]);
				func(node, key, path, type);
				if (type === 'object' || type === 'array') {
					for (var k in node[key]) {
						self.loopJSON(node[key], k, path.concat(k), func);
					}
				}
			} else {
				for (var k in node) {
					self.loopJSON(node, k, path.concat(k), func);
				}
			}
		};

		// callback for json ready
		self.initJSON = function() {

			self.getStateConfig(self.__jsonSaveKey);

			!Object.keys(self.__state.conf.expanded).length ? self.__state.conf.expanded[self.__jsonSaveKey] = true : null;

			// we're passing an invented object to give the root item the appearance of the loaded file url/string

			self.jsonName = self.__config.jsonName || self.__jsonSaveKey.split('/').pop();

			self.__state.help = self.__state.conf.help || self.jsonName;
			self.__state.editMode = self.__state.conf.editMode || 'form';

			if (self.__state.conf.menu !== false) {
				self.__node.attr({
					'data-menu': '1'
				})
			}

			if (window.location.hash.substr(1)) {
				self.__state.help = self.jsonName + '/' + window.location.hash.substr(1);
			}

			var fauxschema = {
				"properties": {}
			};
			fauxschema.properties[self.jsonName] = self.__schema;
			self.__schema = fauxschema;

			self.processJSON();

			self.emit('jsonready', true);
			self.renderState();

		};

		self.processJSON = function() {

			var fauxjson = {};
			fauxjson[self.jsonName] = self.__json;

			self.__state.rows = [];
			self.__state.rowsref = {};
			self.__json_rows.html(''); // clear it in case of re-init/render

			self.loopJSON(fauxjson, undefined, [], function(node, key, path, type) {
				// we use node and key to pass by reference
				var joinpath = path.join('/');
				var schema = self.getSchemaForPath(path);

				if (schema.type && schema.type !== type) {
					node[key] = self.typeCast(node[key], schema.type);
					self.emit('autofix', joinpath, node[key], {
						path: path.concat(key),
						reason: 'type',
						typeFrom: type,
						typeTo: schema.type
					});
					type = schema.type;
				}
				var index = self.__state.rows.push({
					node: node,
					key: key,
					path: path,
					joinpath: joinpath,
					parent: path.slice(0, -1).join('/'),
					type: type,
					schema: schema,
					changed: true,
					expanded: self.__state.conf.expanded[joinpath] || path.length < 2 || self.__state.help.indexOf(joinpath) > -1 ? '1' : 0
				});
				self.__state.rowsref[joinpath] = index - 1;
			});
		};

		// first pass gets all $ref's which require async operations
		self.schemaGetRefs = function(node, callback) {

			var refs = [];

			var buildRefList = function(node) {
				if (typeof node === 'object' && node) {
					for (var k in node) {
						if (typeof node[k] === 'object') {
							if (node[k].$ref) {
								var url = node[k].$ref.split('#')[0];
								if (url) {
									if (refs.indexOf(url) < 0) {
										refs.push(url);
									}
								}
							} else {
								buildRefList(node[k]);
							}
						}
					}
				}
			};

			var setRefs = function(node) {
				if (typeof node === 'object' && node) {
					for (var k in node) {
						if (typeof node[k] === 'object') {
							if (node[k].$ref) {
								var spl = node[k].$ref.split('#');
								var url = spl[0] || '';
								var path = spl[1] || '';
								if (path[0] === '/') {
									path = path.substr(1);
								}
								var useObject = self.__refs[url] || self.__schema;
								node[k] = path ? self.getFromPath(useObject, path.split('/')) : useObject;
							} else {
								setRefs(node[k]);
							}
						}
					}
				}

			};

			buildRefList(node);

			var out = 0,
				done = 0,
				error = false,
				complete = function() {
					done++;
					if (done === out) {
						setRefs(node);
						callback(error, true);
					}
				};
			out++;
			refs.forEach(function(url) {
				out++;
				if (self.__refs[url]) {
					setTimeout(complete, 0); // timing i guess
				} else {
					self.fetch(url, function(err, schema) {
						if (!schema) {
							self.emit('error', 'ref schema request error' + err);
							error = new Error('could not get or parse reference schema ' + url);
							setTimeout(complete, 0); // timing i guess
						} else {
							self.__refs[url] = schema;
							self.schemaGetRefs(schema, function(err, success) {
								if (err) {
									error = new Error('could not build sub-schema');
								}
								complete();
							});
						}

					});
				}
			});
			setTimeout(complete, 0); // timing i guess

		};

		self.initSchema = function(schema) {
			self.__ref_urls = [];
			self.__refs = {};
			self.schemaGetRefs(schema, function(err, success) {
				self.emit('schemaready', true);
				self.json(self.__config.json);
			});
		};

		// accept a javascript object for the scheme or a URL
		// schema is loaded first and then the json so it can auto fix based on the schema
		self.schema = function(schema) {
			if (!schema) {
				self.__schema = {};
				return false;
			}
			if (typeof schema === 'object') {
				self.__schema = schema;
				self.initSchema(self.__schema);
			} else {
				self.fetch(schema, function(err, schema) {
					if (!schema) {
						self.emit('error', 'request error' + err);
					}
					self.schema(schema);
				});
			}
		};

		self.getSchemaForPath = function(path) {

			var checkSchemas = {
					0: [self.__schema]
				},
				schema = {};


			path.forEach(function(key, i) {
				var nextSchemas = [];

				if (i > 0) {
					var parentPath = path.slice(0, i);
					if (self.__state.rows[self.__state.rowsref[parentPath.join('/')]].type === 'array') {
						var itemSchema = self.getSchemaForPath(parentPath);
						if (itemSchema.items) {
							nextSchemas.push(itemSchema.items);
						}
					}
				}

				if (checkSchemas[i]) {
					checkSchemas[i].forEach(function(schema) {
						if (schema.properties) {
							if (schema.properties[key]) {
								nextSchemas.push(schema.properties[key]);
							}
						}
						if (schema.patternProperties) {
							for (var pattern in schema.patternProperties) {
								var re = new RegExp(pattern);
								if (re.test(key)) {
									nextSchemas.push(schema.patternProperties[pattern]);
								}
							}
						}
					});
				}
				checkSchemas[i + 1] = (checkSchemas[i + 1] || []).concat(nextSchemas);
			});

			if (checkSchemas[path.length]) {
				checkSchemas[path.length].forEach(function(sc) {
					for (var k in sc) {
						if (typeof schema[k] === 'undefined') {
							schema[k] = sc[k];
						}
					}
				});
			}
			return schema;
		};

		self.typeCast = function(val, type) {
			if (typeof val !== type || val === null) {
				if (!Array.isArray(val) && type === 'array') {
					val = [];
				} else if (type == 'object') {
					val = {};
				} else if (type === 'boolean') {
					val = val ? true : false;
				} else if (type === 'number') {
					val = 0
				} else {
					val = '';
				}
			}
			return val;
		};

		self.addToJSON = function(parentRowstate, key) {
			if (parentRowstate.schema.type === 'array') {
				key = parentRowstate.node[parentRowstate.key].length || 0;
			}
			var newPath = parentRowstate.path.concat(key),
				joinpath = newPath.join('/'),
				schema = self.getSchemaForPath(newPath);

			if (parentRowstate.type === 'object') {
				parentRowstate.node[parentRowstate.key][key] = self.typeCast('', schema.type);
			} else if (parentRowstate.type === 'array') {
				parentRowstate.node[parentRowstate.key].push(self.typeCast('', schema.type));
			}
			self.__track_change(parentRowstate.joinpath, parentRowstate.node[parentRowstate.key]);

			self.processJSON();
			var rowindex = self.__state.rowsref[joinpath];
			return self.__state.rows[rowindex];
		};

		// tries to provide some helpful extra information on the current node row like the name or description or value of the node
		self.getNodeDescription = function(rowstate) {
			var str = '';
			if (rowstate.type === 'object') {
				str = rowstate.node[rowstate.key].name || rowstate.node[rowstate.key].title || rowstate.node[rowstate.key].label || rowstate.node[rowstate.key]._label || rowstate.node[rowstate.key].description;
				return typeof str === 'string' ? '<span class="jsone-node-helper">' + DOM().new('span').text(str).text() + '</span>' : '';
			} else if (rowstate.type === 'number' || rowstate.type === 'string') {
				return '<span class="jsone-node-colon">:</span><span class="jsone-node-value">' + (rowstate.node[rowstate.key] ? DOM().new('span').text(rowstate.node[rowstate.key]).text() : '<span class="jsone-node-empty"></span>') + '</span>';
			} else if (rowstate.type === 'null') {
				return '<span class="jsone-node-helper">null</span>';
			}
			return str;
		};

		//renders each individual key ui segment
		self.renderHelpSegment = function(rowstate, into, context) {
			var secinto = DOM().new('div').class('jsone-help-section').appendTo(into),
				key = secinto,
				val = secinto;

			if (context !== 'main') {
				secinto.class('jsone-help-row').attr({
					'data-path': rowstate.joinpath,
					'data-parent-path': rowstate.parent,
				});

				key = DOM().new('div').class('jsone-help-key').attr({
					title: rowstate.joinpath + ' (' + rowstate.type + ')'
				}).text(rowstate.path[rowstate.path.length - 1]).append(DOM().new('span').class('jsone-node-colon').text(':')).appendTo(secinto);

				val = DOM().new('div').class('jsone-help-value').appendTo(secinto);

				key.append(DOM().new('span').class('jsone-drag-indicator').on('mousedown touchstart', self.sortingEvents));

			}

			if (rowstate.type === 'object' || rowstate.type === 'array') {
				if (context !== 'main') {

					DOM().new('span').html(self.getNodeDescription(rowstate)).appendTo(val)

					key.class('jsone-help-key jsone-help-key-clickable').on('click', function(e) {
						if (!self.__curMoveEvent) {
							self.goToNode(rowstate, true);
						}
					})


					DOM().new('span').text(' »').class('jsone-help-key-clickable').appendTo(val).on('click', function(e) {
						self.goToNode(rowstate, true);
					});
				}
			} else {
				if (self.__config.editable.indexOf(rowstate.schema.format || rowstate.type) > -1) {
					var edit = {
						node: 'textarea',
						attr: {
							placeholder: rowstate.schema.placeholder || ''
						},

					};

					if (rowstate.type === 'boolean') {
						edit.node = 'input';
						edit.attr.type = 'checkbox';
						edit.attr.checked = rowstate.node[rowstate.key]
					} else if (rowstate.schema.format === 'number' || rowstate.schema.format === 'date' || rowstate.schema.format === 'date-time') {
						edit.node = 'input';
						edit.attr.type = rowstate.schema.format.replace(/\-/g, '');
						edit.attr.value = rowstate.node[rowstate.key];
					}
					edit.dom = DOM().new(edit.node).class('jsone-input').attr(edit.attr).appendTo(val).on('input change', function(e) {
						self.inputChangeEvent(edit.dom.elements[0], rowstate.joinpath);
					});
					if(edit.node === 'textarea'){
						edit.dom.text(rowstate.node[rowstate.key] || '').autosizeTextarea();
					}
				}
			}

			if (rowstate.schema.description) {
				DOM().new('div').class('jsone-help-description').html(rowstate.schema.description).appendTo(val);
			}

			if ((rowstate.type === 'object' || rowstate.type === 'array') && context == 'main') {

				var newInto = DOM().new('div').css({
					display: 'table',
				}).appendTo(into);
				for (var k in rowstate.node[rowstate.key]) {
					var newRowState = self.__state.rows[self.__state.rowsref[rowstate.path.concat(k).join('/')]];
					self.renderHelpSegment(newRowState, newInto, 'sub');
				};

				if (rowstate.schema.additionalProperties !== false) {
					if (rowstate.type === 'array') {
						DOM().new('button').text('add row').class('jsone-input jsone-input-add').on('click', function(e) {
							self.addToJSON(rowstate, 'add')
							self.renderState();
						}).appendTo(into)
					} else {
						var datalist = DOM().new('datalist').attr({
							id: 'propertyList'
						});
						if (rowstate.schema.properties) {
							Object.keys(rowstate.schema.properties).forEach(function(property) {
								if (typeof rowstate.node[rowstate.key][property] === 'undefined') {
									var desc = '';
									if (rowstate.schema.properties[property].description) {
										desc += ': ' + rowstate.schema.properties[property].description
									}
									DOM().new('option').attr({
										value: property
									}).text(property + desc).appendTo(datalist);
								}
							})
						}
						var form = DOM().new('form').css({'margin-top': '20px'}).on('submit', function(e) {
								var addprop = form.find('input').elements[0].value || '';
								if (addprop && typeof rowstate.node[rowstate.key][addprop] === 'undefined') {
									self.addToJSON(rowstate, addprop);
								}
								self.renderState();
								e.preventDefault();
							}).append(
								DOM().new('label').class('jsone-ibb').text('add property ')
								.append(
									DOM().new('input').class('jone-input').attr({
										type: 'text',
										list: 'propertyList'
									})
								).append(datalist)
							)
							.append(DOM().new('span').text(' '))
							.append(
								DOM().new('input').class('jsone-input jsone-input-add').attr({
									type: 'submit',
									value: 'add property'
								})
							).appendTo(into)
					}
				}

			}

		};

		self.renderHelpPath = function(rowstate) {
			self.__json_help.html('');

			var top = DOM().new('div').appendTo(self.__json_help);
			DOM().new('span').class('jsone-ibb jsone-help-menu').appendTo(top).on('click', function(e) {
				self.__state.conf.menu = self.__state.conf.menu !== false ? false : true;
				self.__node.attr({
					'data-menu': self.__state.conf.menu !== false ? '1' : '0'
				})
			});
			var titlePath = DOM().new('span').class('jsone-ibb jsone-help-path').appendTo(top);
			var titleOps = DOM().new('span').class('jsone-ibb jsone-help-ops').appendTo(top);

			rowstate.path.forEach(function(key, i) {
				DOM().new('span').class('jsone-ibb jsone-help-key-clickable').text(key).on('click', function(e) {
					self.goToNode(self.__state.rows[self.__state.rowsref[rowstate.parent]], true)
				}).appendTo(titlePath);
				if (i < rowstate.path.length - 1) {
					DOM().new('span').class('jsone-delimiter').text('/').appendTo(titlePath);
				}
			})

			DOM().new('button').attr({
				href: '#'
			}).class('jsone-input').text(self.__state.editMode === 'json' ? 'form' : 'json').appendTo(titleOps).on('click', function(e) {
				self.__state.editMode === 'json' ? self.__state.editMode = 'form' : self.__state.editMode = 'json';
				self.renderState();
			})

			var into = DOM().new('div').class('jsone-help-items').appendTo(self.__json_help);

			if (self.__state.editMode === 'json') {
				var jsonedit = DOM().new('textarea').class('jsone-input jsone-edit-json').appendTo(into).text(JSON.stringify(rowstate.node[rowstate.key], undefined, 2) || '').autosizeTextarea().on('input change', function(e) {
					self.jsonChangeEvent(jsonedit.elements[0], rowstate.joinpath);
				});
			} else {
				self.renderHelpSegment(rowstate, into, 'main');
			}

		};

		self.goToNode = function(rowstate, renderState, noHashChange) {
			self.__state.help = rowstate.joinpath;
			if (!noHashChange && self.__config.hashNavigation) {
				document.location.hash = rowstate.path.slice(1).join('/');
			}
			if (renderState) {
				self.renderState();
			}
		};

		self.renderState = function(conf) {
			if (!conf) {
				conf = {};
			}
			//conf is the state settings we store in local storage and try to load on refresh

			self.__state.conf = {
				__jsone_saveKey: self.__jsonSaveKey,
				expanded: {},
				editMode: self.__state.editMode,
				help: self.__state.help
			};

			self.__state.rows.forEach(function(rowstate) {
				var indent = rowstate.path.length - 1,
					css = {
						'padding-left': (indent * 10) + 'px',
						display: indent > 0 ? 'none' : 'block'
					},
					append = !rowstate.row;

				rowstate.row = (rowstate.row || DOM().new('div').class('jsone-row')).attr({
					'data-children': (rowstate.type !== 'object' && rowstate.type !== 'array') ? '0' : '1',
					'data-expanded': rowstate.expanded,
					'data-active': '0'
				});
				if (rowstate.changed) {
					rowstate.row.html('')
						.append(
							DOM().new('span').class('jsone-row-toggle')
						)
						.append(
							DOM().new('span').class('jsone-row-text').html('<span class="jsone-node-key">' + rowstate.key + '</span>' + self.getNodeDescription(rowstate))
						)
						.css(css)
						.attr({
							title: rowstate.key + ' (' + rowstate.type + ') ' + (rowstate.schema.description || '')
						});
					rowstate.changed = false;
				}
				if (append) {
					rowstate.row.appendTo(self.__json_rows)
						.on('click', function(e) {
							if (e.target.className === 'jsone-row-toggle' || e.target.className === 'jsone-node-key') {
								rowstate.expanded = rowstate.expanded || (rowstate.type !== 'object' && rowstate.type !== 'array') ? 0 : 1;
							}
							if (e.target.className !== 'jsone-row-toggle') {
								self.goToNode(rowstate, false);
							}
							self.renderState();
						});
				}

				if (rowstate.parent) {
					if (self.__state.rows[self.__state.rowsref[rowstate.parent]].expanded) {
						rowstate.row.css({
							display: ''
						});
					} else {
						rowstate.expanded = 0;
						rowstate.row.attr({
							expanded: 0
						}).css({
							display: 'none'
						});
					}
				}

				if (rowstate.expanded) {
					self.__state.conf.expanded[rowstate.joinpath] = true;
				}

				if (!conf.rowsOnly && self.__state.help === rowstate.joinpath) {
					rowstate.row.attr({
						'data-active': '1'
					});
					self.renderHelpPath(rowstate);
				}
			});

			self.saveStateConfig();
		};

		self.saveStateConfig = function() {
			clearTimeout(self.saveConfigTimer);
			self.saveConfigTimer = setTimeout(function() {
				window.localStorage.setItem('jsone_state_config', JSON.stringify(self.__state.conf));
			}, 100);
		};
		self.getStateConfig = function(key) {
			var config = window.localStorage.getItem('jsone_state_config');
			if (config) {
				try {
					config = JSON.parse(config);
				} catch (e) {
					config = {};
				}
			} else {
				config = {};
			}
			if (!config.expanded) {
				config.expanded = {};
			}
			config.__jsone_saveKey === key ? self.__state.conf = config : self.__state.conf = config = {
				expanded: {}
			};
			return;
		};

		// wrap fetches so we can use a url replace. We do this for testing so we can map domains to localhost etc
		self.fetch = function(url, callback) {
			if (self.__config.url_replace) {
				Object.keys(self.__config.url_replace).forEach(function(from) {
					url = url.replace(from, self.__config.url_replace[from]);
				});
			}
			__mdd.prototype.http(url, callback);
		}

		self.__node.elements[0].classList.add('jsone');
		self.__json_rows = DOM().new('div').class('jsone-rows').appendTo(self.__node);
		self.__json_help = DOM().new('div').class('jsone-help').appendTo(self.__node);


		self.sortingEvents = function(e) {
			e.preventDefault();
			var target = e.target,
				path = e.target.getAttribute('data-path');
			while (!path && target) {
				if (target.parentNode.className === 'jsone') {
					target = false;
				} else if (target.parentNode) {
					target = target.parentNode;
					path = target.getAttribute('data-path');
				}
			}
			if (e.type === 'mousedown' || e.type === 'touchstart') {
				self.__curMoveEvent = {
					path: path,
					getState: function() {
						self.__curMoveEvent.els = self.__json_help.find('.jsone-help-row').elements
						self.__curMoveEvent.currentOrder = self.__curMoveEvent.els.map(function(el) {
							return el.getAttribute('data-path');
						})
						self.__curMoveEvent.index = self.__curMoveEvent.currentOrder.indexOf(path);
					}
				};
				self.__curMoveEvent.getState();
				window.addEventListener('mousemove', self.sortingEvents)
				window.addEventListener('mouseup', self.sortingEvents)
			} else if (path && self.__curMoveEvent) {
				if (e.type === 'mouseup' || e.type === 'touchend') {
					setTimeout(function() {
						self.__curMoveEvent.getState();
						var parentPath = self.__curMoveEvent.path.split('/').slice(0, -1).join('/');
						var parentRow = self.__state.rows[self.__state.rowsref[parentPath]];
						if (self.__curMoveEvent.currentOrder && (parentRow.type === 'object' || parentRow.type === 'array')) {
							var newValue = parentRow.type !== 'array' ? {} : [];
							self.__curMoveEvent.currentOrder.forEach(function(rowPath) {
								var row = self.__state.rows[self.__state.rowsref[rowPath]];
								parentRow.type !== 'array' ? newValue[row.key] = row.node[row.key] : newValue.push(row.node[row.key])
							})
							parentRow.node[parentRow.key] = newValue;
							self.__track_change(parentPath, newValue);
							self.processJSON();
							self.renderState();
						}
						self.__curMoveEvent = false;
					}, 100);
					window.removeEventListener('mousemove', self.sortingEvents)
					window.removeEventListener('touchend', self.sortingEvents)
				} else if (e.type === 'mousemove' || e.type === 'touchmove') {
					if (path !== self.__curMoveEvent.path) {
						var toIndex = self.__curMoveEvent.currentOrder.indexOf(path);
						var fromRow = self.__curMoveEvent.els[self.__curMoveEvent.index],
							toRow = self.__curMoveEvent.els[toIndex];
						if (fromRow && toRow) {
							if (self.__curMoveEvent.direction === 'down') {
								toRow.parentNode.insertBefore(toRow, fromRow)
							} else {
								toRow.parentNode.insertBefore(fromRow, toRow)
							}
						}
					}
					self.__curMoveEvent.y = e.touches ? e.touches[0].pageY : e.pageY;
					self.__curMoveEvent.direction = self.__curMoveEvent.y < self.__curMoveEvent.lastY ? 'up' : 'down';
					self.__curMoveEvent.lastY = self.__curMoveEvent.y;
				}
			}
		}

		self.__changes = [];
		self.__track_change = function(path, value){
			var thisPathExists = false;
			self.__changes.forEach(function(changedPath){
				if(path.indexOf(changedPath) > -1){
					thisPathExists = true;
				}
			});

			if(!thisPathExists){
				self.__changes.push(path);
			}

			self.emit('change', path, value);
			self.getChanges();
		}
		self.getChanges = function(){
			var changes = [];
			self.__changes.forEach(function(changedPath){
				changes.push({path: changedPath, value:self.valueFromPath(changedPath.split('/').slice(1))});
			});
			return changes;
		}

		self.__listeners = {};
		self.emit = function() {
			// imit to the general listener "event" and the specified event
			if (self.__listeners.event) {
				self.__listeners.event([].slice.call(arguments));
			}
			if (self.__listeners[event]) {
				self.__listeners[event](arguments[0], arguments[1], arguments[2], arguments[3]);
			}
		};

		self.on = function(event, func) {
			if (typeof func === 'function') {
				self.__listeners[event] = func;
			}
		};

		setTimeout(function() {
			self.schema(self.__config.schema);
			self.emit('init', true);
		}, 0);

		__mdd.prototype.stylesheet({
			'.jsone': {
				position: 'relative',
				overflow: 'hidden',
				width: '100%'
			},
			'.jsone-rows': {
				position: 'absolute',
				left: 0,
				top: 0,
				height: '100%',
				'padding-top': '12px',
				'font-family': 'monospace, Courier New',
				'font-size': '12px',
				overflow: 'hidden',
				'overflow-y': 'auto',
				'white-space': 'nowrap',
				width: '300px',
			},
			'.jsone-help': {
				background: '#fff',
				'min-height': '400px',
				'max-height': '400px',
				'overflow-y': 'auto',
				'max-width': '800px',
				transform: 'translate3d(0, 0, 0)',
				transition: 'transform 0.15s ease-in-out'
			},
			'.jsone[data-menu="1"] .jsone-help': {
				width: 'calc(100% - 300px)',
				transform: 'translate3d(300px, 0, 0)'
			},
			'.jsone-ibb': {
				display: 'inline-block',
				'vertical-align': 'middle',
				'box-sizing': 'border-box',
			},
			'.jsone-row': {
				cursor: 'pointer'
			},
			'.jsone-row:hover': {
				'background-color': '#f1f1f1'
			},
			'.jsone-row-text': {
				display: 'inline-block',
				padding: '4px 0'
			},
			'.jsone-row-toggle:before': {
				content: '""',
				display: 'inline-block',
				width: '16px'
			},
			'.jsone-row[data-children="1"] .jsone-row-toggle:before': {
				content: '"+"'
			},
			'.jsone-row[data-children="1"][data-expanded="1"] .jsone-row-toggle:before': {
				content: '"–"'
			},
			'.jsone-row[data-active="1"]': {
				'background-color': '#f1f1f1',
			},
			'.jsone-node-helper': {
				'padding-left': '4px',
				'font-size': '-1',
				color: '#CCC'
			},
			'.jsone-node-key': {
				color: '#9936a1'
			},
			'.jsone-node-colon': {
				'margin-right': '2px'
			},
			'.jsone-node-value': {
				color: '#666'
			},
			'.jsone-node-empty:before': {
				content: '"-"',
				color: '#ccc'
			},
			'.jsone-help-menu': {
				cursor: 'pointer',
				padding: '8px 12px',
				width: '40px'
			},
			'.jsone-help-menu:before': {
				display: 'inline-block',
				transition: 'transform 0.5s ease-in-out',
				transform: 'rotate(0deg)',
				'transform-origin': '50% 50%',
				content: '"»"'
			},
			'.jsone[data-menu="1"] .jsone-help-menu:before': {
				transform: 'rotate(180deg)',
			},
			'.jsone-help-path': {
				padding: '12px 12px 12px 0',
				'width': 'calc(100% - 90px)'
			},
			'.jsone-help-ops': {
				'text-align': 'right',
				'padding-right': '12px',
				'width': '50px'
			},
			'.jsone-help-items': {
				padding: '0 12px 12px 12px'
			},
			'.jsone-help-key': {
				position: 'relative',
				'text-align': 'right',
				padding: '12px 4px 12px 20px',
				display: 'table-cell',
				'vertical-align': 'top',
				overflow: 'hidden',
				'font-weight': 'bold'
			},
			'.jsone-help-key-clickable': {
				color: '#9936a1',
				cursor: 'pointer'
			},
			'.jsone-drag-indicator': {
				cursor: 'move',
				position: 'absolute',
				left: 0,
				'text-align': 'center',
				top: '10px',
				width: '12px',
				height: '12px',
				display: 'inline-block',
			},
			'.jsone-drag-indicator:before': {
				display: 'inline-block',
				content: '"↕"'
			},
			'.jsone-help-value': {
				padding: '12px 0',
				display: 'table-cell',
				'vertical-align': 'top',
				width: '100%'
			},
			'.jsone-help-description': {
				color: '#999'
			},
			'.jsone-help-section': {
				'margin-bottom': '12px'
			},
			'.jsone-help-row': {
				display: 'table-row'
			},
			'.jsone-help-section:first': {
				'border-top-color': '#666'
			},
			'.jsone-delimiter': {
				display: 'inline-block',
				color: '#666',
				padding: '0 2px'
			},
			'.jsone-input': {
				margin: 0,
				padding: '4px',
				border: 0,
				'border-radius': '0',
				'border-bottom': '1px solid #ccc',
				background: '#fff',
				'box-sizing': 'border-box'
			},
			'textarea.jsone-input': {
				resize: 'vertical',
				height: '22px',
				width: '100%'
			},
			'.jsone-input[type="submit"], button.jsone-input': {
				padding: '4px 10px',
				color: '#fff',
				'background-color': '#757575',
				'border-radius': '2px',
				'box-shadow': '0 2px 5px 0 rgba(0,0,0,0.16),0 2px 10px 0 rgba(0,0,0,0.12)'
			},
			'.jsone-input[type="submit"]:disabled, button.jsone-input:disabled': {
				color: '#9F9F9F',
				'background-color': '#DFDFDF'
			},
			'.jsone-input-add:before': {
				display: 'inline-block',
				content: '"+"',
				padding: '4px'
			},
			'.jsone-edit-json': {
				'box-sizing': 'border-box',
				width: '100%',
				height: '400px',
				'background-color': '#272822',
				color: '#f8f8f2'
			}
		}, 'jsone-sheet');

		return this;
	};

	/* dom utils == mini dandom == mdd */
	if (!window.__mdd) {
		window.__mdd = function(sel, target) {
			this.__mdd = true;
			if (typeof sel === 'object') {
				this.elements = sel.__mdd ? sel : [sel];
			} else if (sel) {
				this.elements = [].slice.call((target ? target.__mdd ? target.elements[0] : target : document).querySelectorAll(sel));
			}
			return this;
		};
		__mdd.prototype.on = function(eventNames, execFunc) {
			var self = this;
			eventNames.split(/[\s,]+/).forEach(function(eventName) {
				if (eventName) {
					self.elements.forEach(function(element) {
						element.addEventListener(eventName, execFunc);
					});
				}
			});
			return this;
		};
		__mdd.prototype.find = function(sel) {
			return new __mdd(sel, this);
		};
		__mdd.prototype.new = function(type) {
			this.elements = [document.createElement(type)];
			return this;
		};
		__mdd.prototype.css = function(css) {
			this.elements.forEach(function(element) {
				for (var K in css) {
					element.style.setProperty(K, css[K] + '');
				}
			});
			return this;
		};
		__mdd.prototype.class = function(className) {
			this.elements.forEach(function(element) {
				element.className = className;
			});
			return this;
		};
		__mdd.prototype.attr = function(attr) {
			this.elements.forEach(function(element) {
				for (var K in attr) {
					if (typeof attr[K] !== 'boolean') {
						if (!attr[K] && attr[K] !== 0) {
							element.removeAttribute(K);
						} else {
							element.setAttribute(K, attr[K]);
						}
					} else {
						element[K] = attr[K];
					}
				}
			});
			return this;
		};
		__mdd.prototype.appendTo = function(target) {
			var self = this;
			var targ = target.elements || [target];
			targ.forEach(function(targetElement) {
				self.elements.forEach(function(element) {
					targetElement.appendChild(element);
				});
			});
			return this;
		};
		__mdd.prototype.append = function(el) {
			this.elements.forEach(function(element) {
				el.elements.forEach(function(apel) {
					element.appendChild(apel);
				});
			});
			return this;
		};
		__mdd.prototype.text = function(text) {
			if (typeof text !== 'undefined') {
				this.elements.forEach(function(element) {
					element.textContent = text;
				});
				return this;
			} else {
				var text = '';
				this.elements.forEach(function(element) {
					text += element.textContent || '';
				});
				return text;
			}
		};
		__mdd.prototype.html = function(html) {
			if (typeof html !== 'undefined') {
				this.elements.forEach(function(element) {
					element.innerHTML = html;
				});
				return this;
			} else {
				var html = '';
				this.elements.forEach(function(element) {
					html += element.innerHTML || '';
				});
				return html;
			}
		};
		__mdd.prototype.autosizeTextarea = function(run) {
			var self = this;
			if (run) {
				this.elements.forEach(function(element) {
					element.style.overflow = 'scroll';
					element.style.minHeight = (element.scrollHeight) > 12 ? (element.scrollHeight) + 'px' : '12px';
					element.style.overflow = 'hidden';
				});
			} else {
				this.autosizeTextarea(true);
				this.on('input', function(e) {
					self.autosizeTextarea(true);
				})
			}

			return this;
		};
		__mdd.prototype.stylesheet = function(sheet, id) {
			if (typeof sheet === 'object') {
				var stylesheet = '';
				Object.keys(sheet).forEach(function(selector) {
					stylesheet += selector + ' { ';
					Object.keys(sheet[selector]).forEach(function(property) {
						stylesheet += property + ':' + sheet[selector][property] + ';';
					});
					stylesheet += ' } ';
				});
				sheet = stylesheet;
			}
			var head = document.head || document.getElementsByTagName('head')[0],
				style = document.getElementById(id) || document.createElement('style');
			style.type = 'text/css';
			if (style.styleSheet) {
				style.styleSheet.cssText = sheet;
			} else {
				style.appendChild(document.createTextNode(sheet));
			}
			head.appendChild(style);

		};
		__mdd.prototype.http = function() {
			var config = {},
				url, callback, ret;
			for (var i = arguments.length - 1; i >= 0; i--) {
				if (typeof arguments[i] === 'object') {
					config = arguments[i];
				} else if (typeof arguments[i] === 'string') {
					url = arguments[i];
				} else if (typeof arguments[i] === 'function') {
					callback = arguments[i];
				}
			}
			config.type = config.type || config.data ? 'POST' : 'GET';
			config.url = url || config.url || '';
			config.callback = callback || config.callback || function() {};
			config.data = config.data || '';

			var request = new XMLHttpRequest();
			request.open(config.type, config.url, true);
			request.timeout = config.timeout || 5000;
			request.onload = function() {
				var err = false;
				ret = false;
				if (request.status >= 200 && request.status < 400) {
					ret = request.responseText;
				}
				if (config.json || config.url.substr(-5) === '.json') {
					try {
						ret = JSON.parse(request.responseText);
					} catch (e) {
						err = 'could not parse json from url: ' + config.url;
						ret = false;
					}
				}
				config.callback(err, ret);
			};
			request.onerror = function(err) {
				config.callback(err, false);
			};
			request.ontimeout = function(err) {
				config.callback('timeout', false);
			};
			request.send(config.data);
		};
	}
	var DOM = function(sel, target) {
		return new __mdd(sel, target);
	};

	root.jsone = jsone;
	return this;
})(window);
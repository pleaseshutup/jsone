(function(root) {
	'use strict';

	var jsone = function(config) {
		var self = this;

		self.__config = config || {};
		// the node we write into. Take provided node, query selector, id=jsone or just the body
		self.__node = DOM(config.node || document.querySelector(config.node) || document.getElementById('jsone') || document.body);


		self.__state = {
			rows: [],
			rowsref: {},
			help: 0
		};

		// accept a javascript object or a URL to one
		self.json = function(json) {
			if (!json) {
				self.initJSON();
				return false;
			}
			if (typeof json === 'object') {
				self.__json = json;
				self.initJSON();
			} else {
				__mdd.prototype.http(json, function(json) {
					if (!json) {
						console.error('JSONE: Could not load json', json);
					}
					self.json(json);
				});
			}
		};

		// callback for json ready
		self.initJSON = function() {
			self.loopJSON(self.__json, undefined, [], function(node, key, path, type) {
				// we use node and key to pass by reference
				var joinpath = path.join('/');
				var index = self.__state.rows.push({
						node: node,
						key: key,
						path: path,
						joinpath: joinpath,
						parent: path.slice(0,-1).join('/'),
						type: type,
						changed: true,
						expanded: 0
					})
				self.__state.rowsref[joinpath] = index - 1;
			});

			self.renderState();
		};

		// accept a javascript object for the scheme or a URL
		self.schema = function(schema) {
			if (!schema) {
				self.__schema = {};
				return false;
			}
			if (typeof schema === 'object') {
				self.__schema = schema;
			} else {
				__mdd.prototype.http(schema, function(schema) {
					if (!schema) {
						console.error('JSONE: Could not load schema', schema);
					}
					self.schema(schema);
				});
			}
		};

		// keys all matching keys from the rule path including wildcards
		self.loopRulesForKey = function(rules, key) {
			if (rules[key]) {

			}
			// find wildcard keys to add to rules
			Object.keys(rules).filter(function(ruleKey) {
				return ruleKey.indexOf('*') > -1;
			}).forEach(function(ruleKey) {
				if (new RegExp(ruleKey.replace(/\*/, '\\S'), 'gi').test(key)) {
					for (var k in rules[keys]) {
						rules[key] = rules[ruleKey][k];
					}
				}
			});


		};

		self.loopRulesForKey = function(rules, ruleSet, ruleKey, key) {
			var checkRegex = ruleKey.indexOf('*') > -1 ? new RegExp(ruleKey.replace(/\*/, '\\S'), 'gi').test(key) : false;
			if (checkRegex || ruleKey === key) {
				for (var prop in ruleSet) {
					rules[prop] = ruleSet[prop];
				}
			}
		};

		self.loopRulesForPath = function(rules, rulesPath, node) {
			var key = rulesPath[rulesPath.length - 1];
			for (var k in node) {
				if (k[0] !== '/') {
					self.loopRulesForKey(rules, node[k], k, key);
				} else {
					// this is a path, check if it is valid
					var checkRegex = k.indexOf('*') > -1 ? new RegExp(k.substr(1).replace(/\*/, '\\S'), 'gi').test(rulesPath) : false;
					if (checkRegex || rulesPath === k) {
						for (var ruleKey in node[k]) {
							if (ruleKey[0] === '/') {
								self.loopRulesForPath(rules, rulesPath, node[k]);
							} else {
								self.loopRulesForKey(rules, node[k][ruleKey], ruleKey, key);
							}
						}
					}
				}
			}
		};

		self.getRulesForPath = function(path, callback) {
			var rules = {};
			self.loopRulesForPath(rules, path, self.__schema);

			setTimeout(function() {
				callback(JSON.parse(JSON.stringify(rules || {})));
			}, 1);

			return false;
		};

		self.json(self.__config.json || self.__config.json);
		self.schema(self.__config.schema || self.__config.schema);

		self.getNodeType = function(node) {
			var type = Array.isArray(node) ? 'array' : typeof node;
			if (type === 'object' && node === null) {
				type = 'null';
			}
			return type;
		}

		// exec func on every part of the object, continue looping if the item is an object or array
		self.loopJSON = function(node, key, path, func) {
			if(path.length){
				var type = self.getNodeType(node[key]);
				func(node, key, path, type);
				if (type === 'object' || type === 'array') {
					for (var k in node[key]) {
						console.log('loop', k);
						self.loopJSON(node[key], k, path.concat(k), func);
					}
				}
			} else {
				for (var k in node) {
					self.loopJSON(node, k, path.concat(k), func);
				}
			}
		};

		// tries to provide some helpful extra information on the current node row like the name or description or value of the node
		self.getNodeDescription = function(node, type) {
			var str = '';
			if (type === 'object') {
				str = node.name || node.title || node.label || node.description;
				return str ? '<span class="jsone-node-helper">' + str + '</span>' : '';
			} else if(type === 'number' || type === 'string'){
				str = node;
				return str ? '<span class="jsone-node-value">:' + str + '</span>' : '';
			} else if(type === 'null'){
				return '<span class="jsone-node-helper">null</span>';
			}
			return str;
		};

		//renders each individual key ui segment
		self.renderHelpSegment = function(node, path, type, into, context) {
			var secinto = DOM().new('div').class('jsone-help-section').appendTo(into);

			self.getRulesForPath(path, function(rules) {
				if (rules) {
					if (rules.type) {
						type = rules.type;
					}

					DOM().new('div').class('jsone-help-key').attr({title: path.join('/') + ' ('+type+')'}).html(path[path.length-1]).appendTo(secinto);
					DOM().new('div').class('jsone-help-spacer').appendTo(secinto);

					if (rules.description) {
						DOM().new('div').class('jsone-help-description').html(rules.description).appendTo(secinto);
						DOM().new('div').class('jsone-help-spacer').appendTo(secinto);
					}

					if(type === 'string'){
						DOM().new('textarea').class('jsone-input').attr({'data-path': path.join('/'), placeholder: rules.placeholder || ''}).text(node || '').appendTo(secinto);
						DOM().new('div').class('jsone-help-spacer').appendTo(secinto);
					} else if (type === 'number'){
						DOM().new('input').class('jsone-input').attr({type: 'number','data-path': path.join('/'), placeholder: rules.placeholder || ''}).appendTo(secinto);
						DOM().new('div').class('jsone-help-spacer').appendTo(secinto);
					}
				}
			});

			if (type === 'object') {
				for (var k in node) {
					self.renderHelpSegment(node[k], path.concat(k), self.getNodeType(node[k]), into, 'sub');
				}
			} else if (type === 'array') {

			}

		}

		self.renderHelpPath = function(node, path, type) {
			console.log('rendering help path', node);
			self.__json_help.html('');
			DOM().new('div').class('jsone-help-path').html('Path: ' + path.join('<span class="jsone-delimiter">/</span>')).appendTo(self.__json_help);

			var into = DOM().new('form').class('jsone-help-items').appendTo(self.__json_help).on('submit', function(e){
				e.preventDefault();

				var changed = false;

				into.find('.jsone-input').elements.forEach(function(el){
					var joinpath = el.getAttribute('data-path');
					if(joinpath){
						var rowstate = self.__state.rows[self.__state.rowsref[joinpath]]
						if(rowstate){
							if(rowstate.node[rowstate.key] !== el.value){
								rowstate.node[rowstate.key] = el.value || '';
								rowstate.changed = true;
								changed = true;
							}
						}
					}
				});
				if(changed){
					self.renderState();
				}
			});

			self.renderHelpSegment(node, path, type, into, 'main');

			DOM().new('input').class('jsone-input').attr({type: 'submit', value: 'Save'}).appendTo(into);
		};

		self.renderState = function(){
			self.__state.rows.forEach(function(rowstate){
				var indent = rowstate.path.length - 1,
					css = {
						'padding-left': (indent * 20) + 'px',
						display: indent > 0 ? 'none' : 'block'
					},
					append = !rowstate.row;

				rowstate.row = (rowstate.row || DOM().new('div').class('jsone-row')).attr({'data-expanded': rowstate.expanded, 'data-active': '0'});
				if(rowstate.changed){
					rowstate.row.html('')
					.append(
						DOM().new('span').class('jsone-row-text').html('<span class="jsone-node-key">'+rowstate.path[rowstate.path.length - 1]+'</span>' + self.getNodeDescription(rowstate.node[rowstate.key], rowstate.type))
					)
					.css(css)
					.attr({
						'data-children': rowstate.type === 'object' || rowstate.type === 'array' ? '1' : '0',
					})
					rowstate.changed = false;
				}
				if(append){
					rowstate.row.appendTo(self.__json_rows)
					.on('click', function(e) {
						rowstate.expanded = rowstate.expanded ? 0 : 1
						self.__state.help = rowstate.joinpath;
						self.renderState();
					});
				}

				if(rowstate.parent){
					if(self.__state.rows[self.__state.rowsref[rowstate.parent]].expanded){
						rowstate.row.css({display: ''});
					} else {
						rowstate.expanded = 0;
						rowstate.row.attr({expanded: 0}).css({display: 'none'});
					}
				}
				if(self.__state.help === rowstate.joinpath){
					rowstate.row.attr({'data-active': '1'})
					self.renderHelpPath(rowstate.node[rowstate.key], rowstate.path, rowstate.type, 'main');
				}
			});
		}

		self.__node.elements[0].classList.add('jsone');
		self.__json_rows = DOM().new('div').class('jsone-rows').appendTo(self.__node);
		self.__json_help = DOM().new('div').class('jsone-help').appendTo(self.__node);

		__mdd.prototype.stylesheet({
			'.jsone': {
				display: 'flex'
			},
			'.jsone-rows': {
				'font-family': 'monospace, Courier New',
				'font-size': '12px',
				width: '50%',
			},
			'.jsone-help': {
				'background-color': '#eaeaea',
				width: '50%',
			},
			'.jsone-row': {
				cursor: 'pointer'
			},
			'.jsone-row:hover': {
				'background-color': '#eaeaea'
			},
			'.jsone-row-text': {
				display: 'inline-block',
				padding: '4px 0'
			},
			'.jsone-row:before': {
				content: '""',
				display: 'inline-block',
				width: '16px'
			},
			'.jsone-row[data-children="1"]:before': {
				content: '"+"'
			},
			'.jsone-row[data-expanded="1"]:before': {
				content: '"–"'
			},
			'.jsone-row[data-active="1"]': {
				'background-color': '#eaeaea'
			},
			'.jsone-node-helper': {
				'padding-left': '4px',
				'font-size': '-1',
				color: '#CCC'
			},
			'.jsone-node-key': {
				color: '#9936a1'
			},
			'.jsone-node-value': {
				'padding-left': '4px',
				'font-size': '-1',
				color: '#666'
			},
			'.jsone-help-path': {
				padding: '12px'
			},
			'.jsone-help-items': {
				padding: '0 12px 12px 12px'
			},
			'.jsone-help-key': {
				'font-weight': 'bold'
			},
			'.jsone-help-spacer': {
				padding: '2px 0'
			},
			'.jsone-help-section': {
				'border-top': '1px solid #ccc',
				padding: '12px 0'
			},
			'.jsone-help-section:first': {
				'border-top-color': '#666'
			},
			'.jsone-delimiter': {
				display: 'inline-block',
				color: '#666',
				padding: '0 2px'
			},
			'.jsone-input':{

			},
			'textarea.jsone-input': {
				width: '100%',
				border: '1px solid #ccc',
				'box-sizing': 'border-box'
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
					element.setAttribute(K, attr[K]);
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
			this.elements.forEach(function(element) {
				element.textContent = text;
			});
			return this;
		};
		__mdd.prototype.html = function(html) {
			this.elements.forEach(function(element) {
				element.innerHTML = html;
			});
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
				ret = false;
				if (request.status >= 200 && request.status < 400) {
					ret = request.responseText;
				}
				if (config.json || config.url.substr(-5) === '.json') {
					try {
						ret = JSON.parse(request.responseText);
					} catch (e) {
						console.error(e);
						ret = false;
					}
				}
				config.callback(ret);
			};
			request.onerror = function() {
				config.callback(false);
			};
			request.ontimeout = function() {
				config.callback(false);
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
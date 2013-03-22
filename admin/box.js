(function() {
  var ENTER_KEY, get_mustache_template, remove_row, row_wait;

  ENTER_KEY = 13;

  row_wait = function($td) {
    return $td.find('.p2p-icon').css('background-image', 'url(' + P2PAdminL10n.spinner + ')');
  };

  remove_row = function($td) {
    var $table;
    $table = $td.closest('table');
    $td.closest('tr').remove();
    if (!$table.find('tbody tr').length) {
      return $table.hide();
    }
  };

  get_mustache_template = function(name) {
    return jQuery('#p2p-template-' + name).html();
  };

  window.P2PAdmin = {
    boxes: {}
  };

  P2PAdmin.Candidate = Backbone.Model.extend({});

  P2PAdmin.Connection = Backbone.Model.extend({});

  P2PAdmin.Candidates = Backbone.Collection.extend({
    model: P2PAdmin.Candidate,
    sync: function() {
      var params,
        _this = this;
      params = _.extend({}, this.attributes, {
        subaction: 'search'
      });
      return this.ajax_request(params, function(response) {
        var _ref;
        _this.total_pages = ((_ref = response.navigation) != null ? _ref['total-pages-raw'] : void 0) || 1;
        return _this.trigger('sync', response);
      });
    },
    validate: function(attrs) {
      var _ref;
      if ((0 < (_ref = attrs['paged']) && _ref <= this.total_pages)) {
        return null;
      }
      return 'invalid page';
    }
  });

  P2PAdmin.Connections = Backbone.Collection.extend({
    model: P2PAdmin.Connection,
    createItemAndConnect: function(title) {
      var data,
        _this = this;
      data = {
        subaction: 'create_post',
        post_title: title
      };
      return this.ajax_request(data, function(response) {
        return _this.trigger('create', response);
      });
    },
    create: function(candidate) {
      var data,
        _this = this;
      data = {
        subaction: 'connect',
        to: candidate.get('id')
      };
      return this.ajax_request(data, function(response) {
        return _this.trigger('create', response);
      });
    },
    "delete": function(connection) {
      var data,
        _this = this;
      data = {
        subaction: 'disconnect',
        p2p_id: connection.get('id')
      };
      return this.ajax_request(data, function(response) {
        return _this.trigger('delete', response, connection);
      });
    },
    clear: function() {
      var data,
        _this = this;
      data = {
        subaction: 'clear_connections'
      };
      return this.ajax_request(data, function(response) {
        return _this.trigger('clear', response);
      });
    }
  });

  P2PAdmin.ConnectionsView = Backbone.View.extend({
    events: {
      'click th.p2p-col-delete .p2p-icon': 'clear',
      'click td.p2p-col-delete .p2p-icon': 'delete'
    },
    initialize: function(options) {
      this.maybe_make_sortable();
      this.collection.on('create', this.afterCreate, this);
      this.collection.on('clear', this.afterClear, this);
      return options.candidates.on('promote', this.afterPromote, this);
    },
    maybe_make_sortable: function() {
      if (this.$('th.p2p-col-order').length) {
        return this.$('tbody').sortable({
          handle: 'td.p2p-col-order',
          helper: function(e, ui) {
            ui.children().each(function() {
              var $this;
              $this = jQuery(this);
              return $this.width($this.width());
            });
            return ui;
          }
        });
      }
    },
    clear: function(ev) {
      var $td;
      ev.preventDefault();
      if (!confirm(P2PAdminL10n.deleteConfirmMessage)) {
        return;
      }
      $td = jQuery(ev.target).closest('td');
      row_wait($td);
      return this.collection.clear();
    },
    afterClear: function() {
      return this.$el.hide().find('tbody').html('');
    },
    "delete": function(ev) {
      var $td, req;
      ev.preventDefault();
      $td = jQuery(ev.target).closest('td');
      row_wait($td);
      req = this.collection["delete"](new P2PAdmin.Connection({
        id: $td.find('input').val()
      }));
      req.done(function() {
        return remove_row($td);
      });
      return null;
    },
    afterPromote: function($td) {
      this.collection.create(new P2PAdmin.Candidate({
        id: $td.find('div').data('item-id')
      }));
      return null;
    },
    afterCreate: function(response) {
      this.$el.show().find('tbody').append(response.row);
      return this.collection.trigger('append', response);
    }
  });

  P2PAdmin.CandidatesView = Backbone.View.extend({
    template: Mustache.compile(get_mustache_template('tab-list')),
    events: {
      'keypress :text': 'handleReturn',
      'keyup :text': 'handleSearch',
      'click .p2p-prev, .p2p-next': 'changePage',
      'click td.p2p-col-create div': 'promote'
    },
    initialize: function(options) {
      this.spinner = options.spinner;
      options.connections.on('create', this.afterConnectionCreated, this);
      options.connections.on('delete', this.afterCandidatesRefreshed, this);
      options.connections.on('clear', this.afterCandidatesRefreshed, this);
      this.collection.on('sync', this.afterCandidatesRefreshed, this);
      this.collection.on('error', this.afterInvalid, this);
      return this.collection.on('invalid', this.afterInvalid, this);
    },
    afterConnectionCreated: function(response, candidate) {
      var $td;
      $td = this.$el.find('.p2p-col-create div[data-item-id="' + candidate.get('id') + '"]');
      if (this.options.duplicate_connections) {
        return $td.find('.p2p-icon').css('background-image', '');
      } else {
        return remove_row($td);
      }
    },
    promote: function(ev) {
      var $td;
      $td = jQuery(ev.target).closest('td');
      ev.preventDefault();
      row_wait($td);
      this.collection.trigger('promote', $td);
      return null;
    },
    handleReturn: function(ev) {
      if (ev.keyCode === ENTER_KEY) {
        ev.preventDefault();
      }
      return null;
    },
    handleSearch: function(ev) {
      var $searchInput, delayed,
        _this = this;
      if (delayed !== void 0) {
        clearTimeout(delayed);
      }
      $searchInput = jQuery(ev.target);
      delayed = setTimeout(function() {
        var searchStr;
        searchStr = $searchInput.val();
        if (searchStr === _this.collection.get('s')) {
          return;
        }
        _this.spinner.insertAfter(_this.searchInput).show();
        return _this.collection.save({
          's': searchStr,
          'paged': 1
        });
      }, 400);
      return null;
    },
    changePage: function(ev) {
      var $navButton, new_page;
      $navButton = jQuery(ev.currentTarget);
      new_page = this.collection.get('paged');
      if ($navButton.hasClass('p2p-prev')) {
        new_page--;
      } else {
        new_page++;
      }
      this.spinner.appendTo(this.$('.p2p-navigation'));
      return this.collection.save('paged', new_page);
    },
    afterCandidatesRefreshed: function(response) {
      this.spinner.remove();
      this.$('button, .p2p-results, .p2p-navigation, .p2p-notice').remove();
      return this.$el.append(this.template(response));
    },
    afterInvalid: function() {
      return this.spinner.remove();
    }
  });

  P2PAdmin.CreatePostView = Backbone.View.extend({
    events: {
      'click button': 'createItem',
      'keypress :text': 'handleReturn'
    },
    initialize: function(options) {
      this.createButton = this.$('button');
      return this.createInput = this.$(':text');
    },
    handleReturn: function(ev) {
      if (ev.keyCode === ENTER_KEY) {
        this.createButton.click();
        ev.preventDefault();
      }
      return null;
    },
    createItem: function(ev) {
      var req, title;
      ev.preventDefault();
      if (this.createButton.hasClass('inactive')) {
        return false;
      }
      title = this.createInput.val();
      if (title === '') {
        this.createInput.focus();
        return;
      }
      this.createButton.addClass('inactive');
      req = this.collection.createItemAndConnect(title);
      req.done(function() {
        this.createInput.val('');
        return this.createButton.removeClass('inactive');
      });
      return null;
    }
  });

  P2PAdmin.MetaboxView = Backbone.View.extend({
    events: {
      'click .p2p-toggle-tabs': 'toggleTabs',
      'click .wp-tab-bar li': 'setActiveTab'
    },
    initialize: function(options) {
      this.spinner = options.spinner;
      this.initializedCandidates = false;
      options.connections.on('append', this.afterConnectionAppended, this);
      options.connections.on('clear', this.afterConnectionDeleted, this);
      return options.connections.on('delete', this.afterConnectionDeleted, this);
    },
    toggleTabs: function(ev) {
      var $tabs;
      ev.preventDefault();
      $tabs = this.$('.p2p-create-connections-tabs');
      $tabs.toggle();
      if (!this.initializedCandidates && $tabs.is(':visible')) {
        this.options.candidates.sync();
        this.initializedCandidates = true;
      }
      return null;
    },
    setActiveTab: function(ev) {
      var $tab;
      ev.preventDefault();
      $tab = jQuery(ev.currentTarget);
      this.$('.wp-tab-bar li').removeClass('wp-tab-active');
      $tab.addClass('wp-tab-active');
      return this.$el.find('.tabs-panel').hide().end().find($tab.data('ref')).show().find(':text').focus();
    },
    afterConnectionAppended: function(response) {
      if ('one' === this.options.cardinality) {
        return this.$('.p2p-create-connections').hide();
      }
    },
    afterConnectionDeleted: function(response) {
      if ('one' === this.options.cardinality) {
        return this.$('.p2p-create-connections').show();
      }
    }
  });

  jQuery(function() {
    var clearVal, setVal;
    if (!jQuery('<input placeholder="1" />')[0].placeholder) {
      setVal = function() {
        var $this;
        $this = jQuery(this);
        if (!$this.val()) {
          $this.val($this.attr('placeholder'));
          $this.addClass('p2p-placeholder');
        }
        return void 0;
      };
      clearVal = function() {
        var $this;
        $this = jQuery(this);
        if ($this.hasClass('p2p-placeholder')) {
          $this.val('');
          $this.removeClass('p2p-placeholder');
        }
        return void 0;
      };
      jQuery('.p2p-search input[placeholder]').each(setVal).focus(clearVal).blur(setVal);
    }
    Mustache.compilePartial('table-row', get_mustache_template('table-row'));
    return jQuery('.p2p-box').each(function() {
      var $metabox, $spinner, ajax_request, candidates, candidatesView, connections, connectionsView, createPostView, ctype, metaboxView;
      $metabox = jQuery(this);
      $spinner = jQuery('<img>', {
        'src': P2PAdminL10n.spinner,
        'class': 'p2p-spinner'
      });
      candidates = new P2PAdmin.Candidates;
      candidates.params = {
        's': '',
        'paged': 1
      };
      candidates.total_pages = $metabox.find('.p2p-total').data('num') || 1;
      ctype = {
        p2p_type: $metabox.data('p2p_type'),
        direction: $metabox.data('direction'),
        from: jQuery('#post_ID').val()
      };
      ajax_request = function(options, callback) {
        var params;
        params = _.extend({}, options, candidates.params, ctype, {
          action: 'p2p_box',
          nonce: P2PAdminL10n.nonce
        });
        return jQuery.post(ajaxurl, params, function(response) {
          try {
            response = jQuery.parseJSON(response);
          } catch (e) {
            if (typeof console !== "undefined" && console !== null) {
              console.error('Malformed response', response);
            }
            return;
          }
          if (response.error) {
            return alert(response.error);
          } else {
            return callback(response);
          }
        });
      };
      candidates.ajax_request = ajax_request;
      connections = new P2PAdmin.Connections;
      connections.ajax_request = ajax_request;
      connectionsView = new P2PAdmin.ConnectionsView({
        el: $metabox.find('.p2p-connections'),
        collection: connections,
        candidates: candidates
      });
      candidatesView = new P2PAdmin.CandidatesView({
        el: $metabox.find('.p2p-tab-search'),
        collection: candidates,
        connections: connections,
        spinner: $spinner,
        duplicate_connections: $metabox.data('duplicate_connections')
      });
      createPostView = new P2PAdmin.CreatePostView({
        el: $metabox.find('.p2p-tab-create-post'),
        collection: connections
      });
      metaboxView = new P2PAdmin.MetaboxView({
        el: $metabox,
        spinner: $spinner,
        cardinality: $metabox.data('cardinality'),
        candidates: candidates,
        connections: connections
      });
      return P2PAdmin.boxes[ctype.p2p_type] = {
        candidates: candidates,
        connections: connections
      };
    });
  });

}).call(this);

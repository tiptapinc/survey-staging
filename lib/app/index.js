var app = require('derby').createApp(module)
  .use(require('derby-ui-boot'))
  .use(require('../../ui'))

////////////////////////////////////////////////////////
// ROUTES /////////////////////////////////////////////
//////////////////////////////////////////////////////

// Derby routes are rendered on the client and the server
app.get('/', function(page) {
  page.render('home');
});

app.get('/list', function(page, model, params, next) {
  // This value is set on the server in the `createUserId` middleware
  var userId = model.get('_session.userId');

  // Create a scoped model, which sets the base path for all model methods
  var user = model.at('users.' + userId);

  // Create a mongo query that gets the current user's items
  var itemsQuery = model.query('items', {userId: userId});

  // Get the inital data and subscribe to any updates
  model.subscribe(user, itemsQuery, function(err) {
    if (err) return next(err);

    // Create references that can be used in templates or controller methods
    model.ref('_page.user', user);
    itemsQuery.ref('_page.items');

    user.increment('visits');
    page.render('list');
  });
});


app.get('/textarea', function(page, model, params, next) {
  // This value is set on the server in the `createUserId` middleware
    var text = model.at("text." + params.id);
    text.subscribe(function(err) {
      if(err) return next(err);

      model.ref('_page.text', text);
      page.render('textarea');
    })
});


app.get('/upload-image', function(page) {
  page.render('upload-image');
});


app.get('/todolist/:groupName', function(page, model, params, next){

  var group = model.at("groups." + params.groupName);
  group.subscribe(function(err){
      if(err) return next(err);

      var todoIds = group.at('todoIds');

      if (todoIds.get() != [])
      {
        var id0 = model.add('todos', {completed: true, text: 'Test'});
        var id1 = model.add('todos', {completed: false, text: 'Moni Moni'});
        todoIds.set([id1, id1]);
      }

      model.query('todos', todoIds).subscribe(function(err){
        if(err) return next(err);

        var list = model.refList('_page.list', 'todos', todoIds);
        page.render('todolist')
      });
  });
});

/////////////////////////////////////////////////////////
// CONTROLLER FUNCTIONS ////////////////////////////////
///////////////////////////////////////////////////////

app.fn('list.add', function(e, el) {
  var newItem = this.model.del('_page.newItem');
  if (!newItem) return;
  newItem.userId = this.model.get('_session.userId');
  this.model.add('items', newItem);
});

app.fn('list.remove', function(e) {
  var id = e.get(':item.id');
  this.model.del('items.' + id);
});

//............................................. TODOS

app.fn('add', function(e){
  var text = this.newTodo.get();
  if (text != undefinded)
  {
    this.newTodo.del();
  }
  var todos = this.list.get();
  for (var i=0; i<todos.length; i++)
  {
    if(todos[i].completed)
    {
      break;
    }

    todos.insert(i, {text: text, completed: false});
  }  
});

app.fn('del', function(e){
  e.at().remove();
});

app.ready(function(model){
  this.list = model.at('_page.list');
  this.newTodo = model.at('_page.newTodo');

  //Make the list draggable using jQuery UI
  var from = null;
  var ul = $('#todos');
  ul.sortable({
    handle: '.handle',
    axis: 'y',
    containment: '#dragbox',
    start: function(e,ui){
      var item = ui.item[0];
      var from = ul.children().index(item);
    },
    update: function(e,ui){
      var item = ui.item[0];
      var to = ul.children().index(item);

      //Use the Derby ignore option to suppress the normal move event binding,
      //since jQuery UI will move the element in the DOM.
      //Also, note that refList index arguments can either be an index
      //or the item's id property.

      this.list.pass({ignore: item.id}).move(from,to);
    }
  });

  this.list.on('change', '*.completed', function(i, completed, previous, isLocal){
    //move the item to the bottom if it was checked off
    if (this.list.completed && this.list.isLocal)
    {
      this.list.move(i, -1);
    }
  });

});

/////////////////////////////////////////////////////////
// REACTIVE FUNCTIONS //////////////////////////////////
///////////////////////////////////////////////////////

//............................................. TODOS
app.view.fn('remaining', function(todos){
  var remaining = 0;
  for (todo in todos)
  {
    if(todo && !todo.completed)
    {
      remaining++;
    }
  }
});

//
const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');


const Producto = require('../models/producto');
const Pedido = require('../models/pedido');


exports.getProductos = (req, res, next) => {
  Producto.find()
    .then(productos => {
      res.render('tienda/lista-productos', {
        prods: productos,
        titulo: 'Todos los Productos',
        path: '/productos',
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProducto = (req, res, next) => {
  const idProducto = req.params.idProducto;
  Producto.findById(idProducto)
    .then(producto => {
      res.render('tienda/detalle-producto', {
        producto: producto,
        titulo: producto.nombre,
        path: '/productos',
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
  };


exports.getIndex = (req, res, next) => {
  Producto.find()
  .then(productos => {
    res.render('tienda/index', {
      prods: productos,
      titulo: 'Tienda',
      path: '/',
    });
  })
  .catch(err => {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
};

exports.getCarrito = (req, res, next) => {
  req.usuario
    .populate('carrito.items.idProducto')
    .then(usuario => {
      const productos = usuario.carrito.items;
      res.render('tienda/carrito', {
        path: '/carrito',
        titulo: 'Mi Carrito',
        productos: productos,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
  };

exports.postCarrito = (req, res, next) => {
  const idProducto = req.body.idProducto;
  Producto.findById(idProducto)
    .then(producto => {
      return req.usuario.agregarAlCarrito(producto);
    })
    .then(result => {
      res.redirect('/carrito');
    });
};

exports.postEliminarProductoCarrito = (req, res, next) => {
  const idProducto = req.body.idProducto;
  req.usuario
    .deleteItemDelCarrito(idProducto)
    .then(result => {
      res.redirect('/carrito');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postPedido = (req, res, next) => {
  req.usuario
    .populate('carrito.items.idProducto')
    .then(usuario => {
      const productos = usuario.carrito.items.map(i => {
        return { cantidad: i.cantidad, producto: { ...i.idProducto._doc } };
      });
      const pedido = new Pedido({
        usuario: {
          email: req.usuario.email,
          idUsuario: req.usuario
        },
        productos: productos
      });
      return pedido.save();
    })
    .then(result => {
      return req.usuario.limpiarCarrito();
    })
    .then(() => {
      res.redirect('/pedidos');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });

};

exports.getPedidos = (req, res, next) => {
  Pedido.find({ 'usuario.idUsuario': req.usuario._id })
    .then(pedidos => {
      res.render('tienda/pedidos', {
        path: '/pedidos',
        titulo: 'Mis Pedidos',
        pedidos: pedidos,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};


exports.getComprobante = (req, res, next) => {
  const idPedido = req.params.idPedido;
  Pedido.findById(idPedido)
    .then(pedido => {
      if (!pedido) {
        return next(new Error('No se encontro el pedido'));
      }
      if (pedido.usuario.idUsuario.toString() !== req.usuario._id.toString()) {
        return next(new Error('No Autorizado'));
      }
      const nombreComprobante = 'comprobante-' + idPedido + '.pdf';
      // const nombreComprobante = 'comprobante-' + '.pdf';
      const rutaComprobante = path.join('data', 'comprobantes', nombreComprobante);
      /*
      fs.readFile(rutaComprobante, (err, data) => {
        if (err) {
          return next(err);
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          'inline; filename="' + nombreComprobante + '"'
        );
        res.send(data);
      });*/
      /*
      const file = fs.createReadStream(rutaComprobante);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + nombreComprobante + '"'
      );
      file.pipe(res); */

      const pdfDoc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + nombreComprobante + '"'
      );
      pdfDoc.pipe(fs.createWriteStream(rutaComprobante));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text('Comprobante', {
        underline: true
      });
      pdfDoc.fontSize(14).text('---------------------------------------');
      let precioTotal = 0;
      pedido.productos.forEach(prod => {
        precioTotal += prod.cantidad * prod.producto.precio;
        pdfDoc
          .fontSize(14)
          .text(
            prod.producto.nombre +
              ' - ' +
              prod.cantidad +
              ' x ' +
              'S/' +
              prod.producto.precio
          );
      });
      pdfDoc.text('---------------------------------------');
      pdfDoc.fontSize(20).text('Precio Total: S/' + precioTotal);

      pdfDoc.end();
    })
    .catch(err => next(err));
};

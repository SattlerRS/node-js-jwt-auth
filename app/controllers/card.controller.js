const db = require('../models');
const Card = db.card;
const Product = db.product;

// Eintrag in den Warenkorb hinzufügen
exports.addToCard = (req, res) => {
  const { quantity, userId, productId } = req.body;
  // Überprüfen, ob die erforderlichen Daten vorhanden sind
  if (!quantity || !userId || !productId) {
    return res.status(400).send({ message: "Missing required data." });
  }

  // Überprüfen, ob die productid bereits in der Karte vorhanden ist
  Card.findOne({ where: { userid: userId, productid: productId } })
    .then((existingCard) => {
      if (existingCard) {
        // Wenn die productid bereits in der Karte vorhanden ist, den Betrag aktualisieren
        const newQuantity = existingCard.amount + parseInt(quantity);
        existingCard.update({ amount: newQuantity })
          .then(() => {
            // Produktmenge im Produktmodell reduzieren
            Product.findByPk(productId)
              .then((product) => {
                const updatedQuantity = product.productamount - parseInt(quantity);
                product.update({ productamount: updatedQuantity })
                  .then(() => {
                    res.send({ message: "Product quantity updated in card." });
                  })
                  .catch((err) => {
                    console.error("Error updating product quantity in card", err);
                    res.status(500).send({ message: "Failed to update product quantity in card." });
                  });
              })
              .catch((err) => {
                console.error("Error finding product", err);
                res.status(500).send({ message: "Failed to find product." });
              });
          })
          .catch((err) => {
            console.error("Error updating product quantity in card", err);
            res.status(500).send({ message: "Failed to update product quantity in card." });
          });
      } else {
        
        // Wenn die productid nicht im Warenkorb vorhanden ist, einen neuen Eintrag erstellen
        Card.create({
          userid: userId,
          productid: productId,
          amount: parseInt(quantity)
        })
          // Produktmenge im Produktmodell reduzieren
          Product.findByPk(productId)
              .then((product) => {
                const updatedQuantity = product.productamount - parseInt(quantity);
                product.update({ productamount: updatedQuantity })
                  .then(() => {
                    res.send({ message: "Product successfully added to card." });
                  })
                  .catch((err) => {
                    console.error("Error updating product quantity", err);
                    res.status(500).send({ message: "Failed to update product quantity." });
                  });
              })
          .catch((err) => {
            console.error("Error adding product to card", err);
            res.status(500).send({ message: "Failed to add product to card." });
          });
      }
    })
    .catch((err) => {
      console.error("Error finding product in card", err);
      res.status(500).send({ message: "Failed to find product in card." });
    });
};

// Warenkorb für User abfragen, nur Card Tabelle
exports.getCardForUser = (req, res) => {
  const userId = req.query.userId; // Hole die userId aus dem Query-Parameter
  
  // Suche nach dem Warenkorbeintrag des Benutzers anhand der userId
  Card.findAll({ where: { userid: userId } })
    .then((card) => {
      if (card) {
        // Warenkorb gefunden, sende sie als Antwort
        res.status(200).json(card);
      } else {
        // Warenkorb nicht gefunden
        res.status(404).json({ message: "Card not found" });
      }
    })
    .catch((error) => {
      // Fehler beim Abrufen des Warenkorbs
      res.status(500).json({ message: "Fail to load Card", error: error });
    });
}

// Warenkorb für User abfragen, Card und Produkt Tabelle
exports.getProductsFromCard = (req, res) => {
  const { userId } = req.query;
  Card.findAll({
    where: { userId },
    include: Product // Inkludiert das Product-Modell
  })
    .then((cards) => {
      res.send({ cards });
    })
    .catch((err) => {
      console.error("Error retrieving products from card", err);
      res.status(500).send({ message: "Failed to retrieve products from card." });
    });
};

// Produkt aus Warenkorb entfernen
exports.delProductFromCard = (req, res) => {
  const cardId = req.query.cardId;
  const productId = req.query.productId;
  const cardAmount = req.query.cardAmount;
  
  // Aktualisiere die Produktmenge
  Product.update(
    {productamount: db.sequelize.literal(`productamount + ${cardAmount}`),},
    {where: { id: productId },}
  )
    .then((numUpdated) => {
      if (numUpdated[0] === 0) {
        // Das Produkt wurde nicht gefunden
        throw new Error("Produkt nicht gefunden.");
      }

      // Lösche den Karteintrag
      return Card.destroy({
        where: { id: cardId },
      });
    })
    .then((numDeleted) => {
      if (numDeleted === 0) {
        // Der Warenkorbeintrag wurde nicht gefunden
        throw new Error("Card entry nor found");
      }

      res.status(204).send();
    })
    .catch((err) => {
      res.status(500).send({ message: err.message || "Internal Server Error." });
    });
};

// Produktmenge im Warenkorb ändern
exports.changeAmountInCard = async (req, res) => {
  const { productAmount, cardAmountOld, cardAmountNew, cardId, productId } = req.body;
  const newProductAmount = cardAmountOld + productAmount - cardAmountNew;

  try {
    // Aktualisiere die Card mit der entsprechenden cardId
    await Card.update({ amount: cardAmountNew }, { where: { id: cardId } });

    // Aktualisiere das Product mit der entsprechenden productId
    await Product.update({ productamount: newProductAmount }, { where: { id: productId } });

    res.status(200).send({ message: 'Update successful.' });
  } catch (error) {
    res.status(500).send({ message: 'Internal Server Error.' });
  }
};

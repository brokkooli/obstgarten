console.clear();

import { useState, useEffect, useRef } from "react";

// firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

const referenceInDB = ref(
  getDatabase(
    initializeApp({
      databaseURL:
        "https://obstgarten-leaderboard-default-rtdb.europe-west1.firebasedatabase.app/",
    }),
  ),
  "ranks",
);

export default function App() {
  const imageMap = import.meta.glob("./img/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  });

  function getImgSrc(name) {
    return imageMap[`./img/${name}.png`];
  }

  const fruits = [
    {
      title: "cherry",
      color: "red",
      count: 3,
    },
    {
      title: "apple",
      color: "green",
      count: 5,
    },
    {
      title: "pear",
      color: "yellow",
    },
    {
      title: "plum",
      color: "violet",
    },
  ];

  const fruitTiles = fruits.flatMap((fruit) =>
    Array.from({ length: fruit.count || 4 }, (_, i) => ({
      title: `${fruit.title}${i + 1}`,
      img: getImgSrc(fruit.title),
      color: fruit.color,
    })),
  );

  function addRandomPosition(tiles) {
    return tiles.map((card) => ({
      ...card,
      _randPos: {
        translateX: Math.round((Math.random() - 0.5) * 15),
        translateY: Math.round((Math.random() - 0.5) * 15),
        rotate: Math.round((Math.random() - 0.5) * 30),
      },
    }));
  }

  function shuffleTiles(tiles) {
    for (let i = tiles.length - 1; i > 0; i--) {
      // eslint-disable-next-line react-hooks/purity
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
  }

  // State
  const [lives, setLives] = useState(8);
  const [matches, setMatches] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  const [hasLost, setHasLost] = useState(false);
  const [allTiles, setAllTiles] = useState(() =>
    addRandomPosition(shuffleTiles(fruitTiles)),
  );
  const [landedDice, setLandedDice] = useState(null); // Fruit to find or crow/basket
  const [isBasketActive, setIsBasketActive] = useState(false); // Show basket overlay
  const [basketFruit, setBasketFruit] = useState(null); // Fruit picked from basket
  const [isBoardLocked, setIsBoardLocked] = useState(true);
  const [isNewRound, setIsNewRound] = useState(false);
  const [message, setMessage] = useState("");
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [isLeaderBoardDisplayed, setIsLeaderBoardDisplayed] = useState(false);
  const [ranks, setRanks] = useState([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // fetch ranks from db
  useEffect(() => {
    onValue(referenceInDB, function (snapshot) {
      if (snapshot.exists()) {
        setRanks(Object.values(snapshot.val()));
      }
    });
  }, []);

  // get random landed dice
  function getLandedDice() {
    const crowTile = {
      title: "crow",
      img: getImgSrc("dice-crow"),
    };

    const basketTile = {
      title: "basket",
      img: getImgSrc("dice-basket"),
    };

    const fruitTiles = fruits.map((fruit) => ({
      title: fruit.title,
      color: fruit.color,
    }));

    const allTileTypes = [...fruitTiles, crowTile, basketTile];

    // eslint-disable-next-line react-hooks/purity
    const randomIndex = Math.floor(Math.random() * allTileTypes.length);

    return allTileTypes[randomIndex];
  }

  // start round
  const newRoundRef = useRef();
  newRoundRef.current = () => {
    if (hasWon || hasLost) return;

    setIsNewRound((prev) => !prev);

    const tile = getLandedDice();
    setLandedDice(tile);
    setBasketFruit(null);

    // If crow, lose life and restart round after delay
    if (tile.title === "crow") {
      setLives((prev) => prev - 1);
      setMessage(`Oh no! The crow jumped closer.`);
      setTimeout(() => {
        newRoundRef.current();
      }, 1500);
      return;
    }
    // If basket, show overlay to pick fruit
    if (tile.title === "basket") {
      setIsBasketActive(true);
      setMessage("Pick a fruit from the basket!");
      return;
    }
    // Otherwise, start round normally
    setIsBoardLocked(false);
    setMessage(`Find the ${tile.color} fruit!`);
  };

  // Start game on first render
  useEffect(() => {
    newRoundRef.current();
  }, []);

  // Tile click handler
  function handleTileClick(clickedTile) {
    if (isBoardLocked || hasWon || hasLost) return;
    // Ignore already flipped tiles
    if (clickedTile.isFlipped) return;

    // Flip clicked tile
    setAllTiles((prev) =>
      prev.map((prevTile) =>
        prevTile.title === clickedTile.title
          ? { ...prevTile, isFlipped: true }
          : prevTile,
      ),
    );

    // If matching fruit
    const tileToMatch = basketFruit || landedDice;

    if (clickedTile.title.startsWith(tileToMatch.title)) {
      setMatches((prev) => prev + 1);
      setMessage("Match! Well done.");
    } else {
      // turn tile back over after short delay
      setTimeout(() => {
        setAllTiles((prev) =>
          prev.map((prevTile) =>
            prevTile.title === clickedTile.title
              ? { ...prevTile, isFlipped: false }
              : prevTile,
          ),
        );
      }, 1000);
      setMessage("No match.");

      //if already flipped once / if key exists at all, count as wrong guess,
      // not if all fruits of tileToMatch are already flipped, unless it's basketfruit and picked wrong

      const allFruitsAsLandedFlipped = allTiles
        .filter((tile) => tile.title.startsWith(tileToMatch.title))
        .every((tile) => tile.isFlipped);

      if (
        "isFlipped" in clickedTile &&
        (!allFruitsAsLandedFlipped || basketFruit)
      ) {
        setWrongGuesses((prev) => prev + 1);
      }

      // ignore last remaining tile wrong guess
      // if ("isFlipped" in clickedTile && (matches < 15 || basketFruit)) {
      //   setWrongGuesses((prev) => prev + 1);
      // }
    }
    setIsBoardLocked(true);
    // Next round after a short delay
    setTimeout(() => {
      newRoundRef.current();
    }, 1500);
  }

  // Basket pick overlay handler
  function handleBasketPick(fruit) {
    setBasketFruit(fruit);
    setIsBasketActive(false);
    setIsBoardLocked(false);
    setMessage(`Now find the ${fruit.color} fruit!`);
  }

  function submitRank(formData) {
    const name = formData.get("name");
    if (!name) return;

    //return early if name and wrong combo exists in db (no duplicates)
    if (
      ranks.find((rank) => rank.name === name && rank.wrong === wrongGuesses)
    ) {
      return;
    }

    push(referenceInDB, {
      name,
      wrong: wrongGuesses,
    });
    setHasSubmitted(true);
  }

  // Win/lose check
  useEffect(() => {
    if (matches >= 16) {
      setHasWon(true);
      setMessage("You win! All fruits found.");
      setTimeout(() => {
        setIsLeaderBoardDisplayed(true);
      }, 1500);
    }
    if (lives <= 0) {
      setHasLost(true);
      setMessage("Game Over! The crow got into the garden.");
    }
  }, [matches, lives]);

  function newGame() {
    setLives(8);
    setMatches(0);
    setHasWon(false);
    setHasLost(false);
    setAllTiles(addRandomPosition(shuffleTiles(fruitTiles)));
    setIsBoardLocked(true);
    setWrongGuesses(0);
    setHasSubmitted(false);
    setIsLeaderBoardDisplayed(false);
    // Start first round after state resets
    setTimeout(() => {
      newRoundRef.current();
    }, 0);
  }

  const tileEls = allTiles.map((tile) => {
    const style = {
      "--translate-x": `${tile._randPos.translateX}px`,
      "--translate-y": `${tile._randPos.translateY}px`,
      "--rotate": `${tile._randPos.rotate}deg`,
    };

    return (
      <div
        className={tile.isFlipped ? "tile flipped" : "tile"}
        style={style}
        onClick={() => handleTileClick(tile)}
        key={tile.title}
      >
        <img
          className="front-face"
          src={tile.img}
          alt={
            tile.isFlipped
              ? `Flipped fruit is ${tile.title.slice(0, -1)}`
              : "Backface"
          }
        />
      </div>
    );
  });

  let lastWrong = null;
  let lastRank = 0;

  const rankEls = ranks
    .sort((a, b) => a.wrong - b.wrong)
    .map((rank, index) => {
      const isNewRank = rank.wrong !== lastWrong;

      if (isNewRank) {
        lastRank++;
        lastWrong = rank.wrong; // remember value for next iteration
      }

      return (
        <div className="rank" key={index}>
          {/* only print the number and the wrong guesses for the first entry
            in a tied group */}
          <span>{isNewRank && lastRank + "."}</span>
          <span>{rank.name}</span>
          <span>{isNewRank && rank.wrong}</span>
        </div>
      );
    });

  return (
    <>
      {isLeaderBoardDisplayed && (
        <section className="leaderboard-section">
          <div className="leaderboard">
            <h1>Leaderboard</h1>
            <div className="rank">
              <span>Rank</span>
              <span>Name</span>
              <span>Wrong</span>
            </div>
            <div className="ranks">{rankEls}</div>
            {!hasSubmitted && (
              <>
                <form action={submitRank}>
                  <p>
                    You had {wrongGuesses > 0 && wrongGuesses <= 8 && "only"}{" "}
                    {wrongGuesses} wrong guess{wrongGuesses !== 1 && "es"}!
                  </p>
                  <input placeholder="Enter your name" name="name"></input>
                  <button>Submit</button>
                  <span>or</span>
                </form>
              </>
            )}
            <button onClick={newGame}>New Game</button>
          </div>
        </section>
      )}
      <section className="garden-section">
        <div className="garden">
          <img
            className={`crow crow-${lives} ${lives < 4 && "crow-flipped"}`}
            src={getImgSrc("crow")}
            alt="crow"
          />
        </div>

        {wrongGuesses > 0 && (
          <span>
            Wrong guess{wrongGuesses !== 1 && "es"}: {wrongGuesses}
          </span>
        )}

        {hasLost && <button onClick={newGame}>New Game</button>}

        {/* {hasWon ? (
          <button onClick={() => setIsLeaderBoardDisplayed(true)}>
            Leaderboard
          </button>
        ) : hasLost ? (
          <button onClick={newGame}>New Game</button>
        ) : (
          ""
        )} */}

        {/* {!hasWon && !hasLost ? (
          <span>{`Lives: ${lives}`}</span>
        ) : (
          <button onClick={newGame}>New Game</button>
        )} */}
      </section>

      <section className="board-section">
        <div
          className={
            hasWon || hasLost || isBasketActive
              ? "board faded locked"
              : isBoardLocked
                ? "board locked"
                : "board"
          }
        >
          {tileEls}
        </div>

        <div className="info">
          <span>{message}</span>

          <div className="dice-container">
            <div
              className={
                isNewRound ? "landed-dice landed-dice-transform" : "landed-dice"
              }
            >
              {
                // show picked fruit after basket selection
                basketFruit ? (
                  <div
                    className="color"
                    aria-label={`Picked fruit is ${basketFruit.color}`}
                  >
                    <div className={basketFruit.color}></div>
                  </div>
                ) : // if crow/basket
                landedDice && !landedDice.color ? (
                  <img
                    src={landedDice.img}
                    alt={`Dice shows ${landedDice.title}`}
                  />
                ) : landedDice && landedDice.color ? (
                  // if fruit
                  <div
                    className="color"
                    aria-label={`Dice shows ${landedDice.color}`}
                  >
                    <div className={landedDice.color}></div>
                  </div>
                ) : (
                  ""
                )
              }
            </div>

            {isBasketActive &&
              fruits.map((fruit) => (
                <div
                  className="landed-dice basket-fruit"
                  key={fruit.title}
                  onClick={() => handleBasketPick(fruit)}
                >
                  <div className="color" aria-label={`Pick ${fruit.color}?`}>
                    <div className={fruit.color}></div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>
    </>
  );
}

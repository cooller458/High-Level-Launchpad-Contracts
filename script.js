const axios = require("axios");
const fs = require("fs");

const tokenAddress = "0xE90334c19c798C3A18d81b8cd16594247D5B19dd";
const apiEndpoint = "https://api.bscscan.com/api";
const apiKey = "";

const getTransactions = async () => {
  try {
    let result = [];
    let page = 1;

    while (true) {
      const response = await axios.get(apiEndpoint, {
        params: {
          module: "account",
          action: "tokentx",
          contractaddress: tokenAddress,
          page: page,
          offset: 100,
          sort: "desc",
          apikey: apiKey,
        },
      });

      const { data } = response;

      if (data.status !== "1" || !data.result.length) {
        break;
      }

      result = result.concat(data.result);
      page++;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return result;
  } catch (error) {
    console.error(error);
  }
};

getTransactions()
  .then((result) => {
    fs.writeFile("transactions.json", JSON.stringify(result), (err) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log("Transactions saved to transactions.json");
    });
  })
  .catch((error) => {
    console.error(error);
  });

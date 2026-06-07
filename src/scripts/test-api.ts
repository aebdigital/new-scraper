async function test() {
  const queries = [
    "https://api.orsf.sk/v1/search?q=43220&limit=5",
    "https://api.orsf.sk/v1/search?q=stavebn%C3%ADctvo&limit=5",
    "https://api.orsf.sk/v1/companies?limit=5"
  ];

  for (const url of queries) {
    console.log(`\nFetching: ${url}`);
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      console.log("Response:", JSON.stringify(data, null, 2).substring(0, 1000));
    } else {
      console.log("Failed:", res.statusText);
    }
  }
}
test();

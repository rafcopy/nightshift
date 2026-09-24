import test from "node:test";
import assert from "node:assert/strict";

import { rank } from "../tools/score.mjs";

test("filters out opportunity types that are not requested", () => {
  const profile = {
    wants: {
      types: ["bounty"],
    },
    skills: {
      strong: ["JavaScript"],
    },
    avoid: {},
  };

  const opportunities = [
    {
      type: "bounty",
      title: "JavaScript bounty",
      description: "Build a JavaScript tool",
      tags: [],
      org: "example",
      value_usd: 100,
    },
    {
      type: "remote_job",
      title: "JavaScript remote job",
      description: "Build a JavaScript backend",
      tags: [],
      org: "example",
      value_usd: 100000,
    },
  ];

  const { shortlist, dropped } = rank(opportunities, profile);

  assert.equal(shortlist.length, 1);
  assert.equal(shortlist[0].type, "bounty");

  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].type, "remote_job");
  assert.equal(
    dropped[0].dropped_because,
    'type "remote_job" is not requested'
  );
});
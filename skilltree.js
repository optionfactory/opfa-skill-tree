class SkillTree {
    /**
     * Node structure:
     *   name: "title" || null
     *   cluster: "type"
     *   rank: n (-1 = hide node)
     *   description: ["lines"] || "line" || null
     *   resources: [{ title: "name", authors: ["name"] || null, link: "https://..." || null }] || null
     *   unlocked: true || false || null
     *   children: [node] || null
     * 
     * Cluster colors: { clusterName: "color html encoding" }
     */
    constructor(structure) {
        this.structure = structure;
    }

    draw(width, height, radius, clusterColors, backgroundSelector, skillTreeSelector, tooltipSelector) {
        const parallaxBg = document.querySelector(backgroundSelector);
        const zoom = d3.zoom()
            .scaleExtent([0.4, 2.5])
            .on("zoom", (event) => {
                svgGroup.attr("transform", event.transform);
                const parallaxMultiplier = 0.3;
                const bgX = event.transform.x * parallaxMultiplier;
                const bgY = event.transform.y * parallaxMultiplier;
                parallaxBg.style.backgroundPosition = `calc(50% + ${bgX}px) calc(50% + ${bgY}px)`;
            });

        const svg = d3.select(skillTreeSelector)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(zoom);

        // Center tree and zoom
        const svgGroup = svg.append("g")
            .attr("transform", `translate(${width / 2},${height / 2}) scale(1)`);
        svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));

        const glowFilters = svg.append("glowFilters");
        const filter = glowFilters.append("filter")
            .attr("id", "glow")
            .attr("x", "-50%").attr("y", "-50%")
            .attr("width", "200%").attr("height", "200%");
        filter.append("feGaussianBlur").attr("stdDeviation", "6").attr("result", "coloredBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        const root = d3.hierarchy(this.structure);
        const treeLayout = d3.tree()
            .size([2 * Math.PI, radius])
            .separation((a, b) => ((a.parent == b.parent ? 1 : 2) + (a.data.cluster === b.data.cluster ? 0 : 1) + (a.data.rank === b.data.rank ? 0 : 1)) + a.depth/2);
        treeLayout(root);

        const linkGenerator = d3.linkRadial()
            .angle(d => d.x)
            .radius(d => d.y);
        const radialLine = d3.lineRadial()
            .angle(d => d.x)
            .radius(d => d.y);
        const lineGenerator = d => radialLine([d.source, d.target]);
        svgGroup.selectAll(".link")
            .data(root.links())
            .enter()
            .append("path")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", d => clusterColors[d.target.data.cluster] || "#555")
            .attr("stroke-width", 4)
            .attr("stroke-opacity", d => d.target.data.unlocked ? 0.8 : 0.2)
            .attr("d", d => d.target.data.rank < 0 ? lineGenerator(d) : linkGenerator(d))
            .style("transition", "stroke-opacity 0.4s ease");

        const describeResource = (res) => {
            const authors = res.authors || [];
            var text = `<strong>${res.title}</strong>`;
            if (!!authors.length) {
                text = text + ` &mdash; <em>${authors.join(", ")}</em>`;
            }
            if (!!res.link) {
                text = `<a href="${res.link}" target="_blank">${text}</a>`;
            }
            return text;
        };

        // Node:
        //   name: "title" || null
        //   description: ["lines"] || "line" || null
        //   resources: [{ title: "name", authors: ["name"] || null, link: "https://..." || null }] || null
        const describe = (node) => {
            const color = clusterColors[node.cluster];
            const description = node.description || [];
            const lines = Array.isArray(description) ? description : [description];
            const resources = node.resources || [];
            return `
            <h2 style="color:${color}">${node.name}</h2>
            <div style="color:#ddd;">
                <p>${lines.join('<br>')}</p>
            </div>
            <h3><em>Resources:</em></h3>
            <div>
                ${resources.map(r => `<p>${describeResource(r)}</p>`).join("")}
            </div>
            `;
        };

        const node = svgGroup.selectAll(".node")
            .data(root.descendants())
            .enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.y * Math.cos(d.x - Math.PI/2)},${d.y * Math.sin(d.x - Math.PI/2)})`)
            .style("cursor", d => d.data.rank < 0 ? "default" : "pointer")
            .on("mouseenter", function(event, d) {
                if (d.data.rank < 0) { return; }
                const tooltip = d3.select(tooltipSelector);
                const color = clusterColors[d.data.cluster];
                tooltip.html(describe(d.data))
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px")
                    .style("border-color", color)
                    .transition("tooltip-show").duration(500).style("opacity", 1);

                d3.select(this).select("circle")
                    .transition("circle-grow").duration(500)
                    .attr("r", 28);
            })
            .on("mouseout", function(event, d) {
                d3.select(tooltipSelector)
                    .transition("tooltip-sustain").duration(5000)
                    .transition("tooltip-hide").duration(500).style("opacity", 0);
                d3.select(this).select("circle")
                    .transition("circle-shrink").duration(500)
                    .attr("r", 22);
            })
            .on("click", function(event, d) {
                if (d.depth < 0 || d.data.rank < 0) return;

                d.data.unlocked = !d.data.unlocked;

                d3.select(this).select("circle")
                    .transition("circle-light").duration(1500)
                    .attr("fill", d.data.unlocked ? clusterColors[d.data.cluster] : "#111")
                    .attr("stroke-width", d.data.unlocked ? 4 : 2)
                    .attr("stroke-opacity", d.data.unlocked ? 1 : 0.75)
                    .attr("filter", d.data.unlocked ? "url(#glow)" : "url(#glow)");

                const leadingToTarget = (l, n) => {
                    if (l.target === n) { return true; }
                    if (n.parent) { return leadingToTarget(l, n.parent); }
                    return false;
                }

                svgGroup.selectAll(".link")
                    .filter(l => leadingToTarget(l, d))
                    .transition("link-light").duration(300)
                    .attr("stroke-opacity", d.data.unlocked ? 0.8 : 0.2);
            });

        node.append("circle")
            .attr("r", 22)
            .attr("pointer-events", d => d.data.rank < 0 ? "none" : "auto")
            .attr("fill", d => d.data.rank < 0 ? "#00000000" : d.data.unlocked ? clusterColors[d.data.cluster] : "#111")
            .attr("stroke", d => d.data.rank < 0 ? "#00000000" : clusterColors[d.data.cluster])
            .attr("stroke-dasharray", d => {
                switch (d.data.rank) {
                    case 0: return "60,10";
                    case 1: return "35,10";
                    case 2: return "18,10";
                    case 3: return "9,10";
                    default: return "none";
                }
            })
            .attr("stroke-width", d => d.data.unlocked ? 4 : 2)
            .attr("stroke-opacity", d => d.data.unlocked ? 1 : 0.75)
            .attr("filter", d => d.data.unlocked ? "url(#glow)" : "url(#glow)")
            .attr("transform", d => `rotate(${d.x}, 0, 0)`)
            .style("transition", "fill 0.3s ease, stroke-width 0.3s ease");

        node.append("text")
            .attr("class", "label")
            .attr("dy", d => Math.cos(d.x) < 0 ? 50 : -50)
            .text(d => d.data.name);
    }
}

function fetchNearbyRelations(q, callback) {
    var newRelation = {
        relation: null,
        value: t('inspector.new_relation'),
        display: t.append('inspector.new_relation')
    };

    var entityID = _entityIDs[0];
    var result = [];
    var graph = context.graph();

    // Selected entities
    var selectedEntities = _entityIDs
        .map(function (id) {
            return graph.hasEntity(id);
        })
        .filter(function (entity) {
            return entity;
        });

    // Map: relationID → number of selected entities in that relation
    var relationCounts = new Map();

    selectedEntities.forEach(function (ent) {
        graph.parentRelations(ent).forEach(function (rel) {
            relationCounts.set(rel.id, (relationCounts.get(rel.id) || 0) + 1);
        });
    });

    function baseDisplayLabel(entity, flags) {
        flags = flags || {};

        var matched = presetManager.match(entity, graph);
        var presetName = (matched && matched.name()) || t('inspector.relation');
        var entityName = utilDisplayName(entity) || '';

        return function (selection) {
            if (flags.isCommon) {
                selection.append('span')
                    .attr('class', 'green strong mr4')
                    .text('(Applied)');
            } else if (flags.isPartial) {
                selection.append('span')
                    .attr('class', 'orange mr4')
                    .text('(Partially Applied)');
            }

            selection.append('b')
                .text(presetName + ' ');

            selection.append('span')
                .classed('has-colour', entity.tags.colour && isColourValid(entity.tags.colour))
                .style('border-color', entity.tags.colour)
                .text(entityName);
        };
    }

    // A location search takes priority over an ID search
    var idMatchResult = q && idMatch(q);
    var relationID = idMatchResult && idMatchResult.id ? idMatchResult.id : q;
    var explicitRelation = context.hasEntity('r' + relationID);

    if (explicitRelation && explicitRelation.type === 'relation' && explicitRelation.id !== entityID) {
        result.push({
            relation: explicitRelation,
            value: baseDisplayValue(explicitRelation) + ' ' + explicitRelation.id,
            display: baseDisplayLabel(explicitRelation),
            title: baseDisplayValue(explicitRelation)
        });
    } else {
        context.history().intersects(context.map().extent()).forEach(function (entity) {
            if (entity.type !== 'relation' || entity.id === entityID) return;

            var value = baseDisplayValue(entity);
            if (q && (value + ' ' + entity.id).toLowerCase().indexOf(q.toLowerCase()) === -1) return;

            var count = relationCounts.get(entity.id) || 0;
            var flags = {
                isCommon: count === selectedEntities.length,
                isPartial: count > 0 && count < selectedEntities.length
            };

            result.push({
                relation: entity,
                value: value,
                display: baseDisplayLabel(entity, flags),
                title: value,
                isCommon: flags.isCommon,
                isPartial: flags.isPartial
            });
        });

        result.sort(function (a, b) {
            return osmRelation.creationOrder(a.relation, b.relation);
        });

        // Dedupe identical names by appending relation id - see #2891
        Object.values(utilArrayGroupBy(result, 'value'))
            .filter(function (v) { return v.length > 1; })
            .flat()
            .forEach(function (obj) {
                obj.value += ' ' + obj.relation.id;
            });
    }

    result.unshift(newRelation);
    callback(result);
}